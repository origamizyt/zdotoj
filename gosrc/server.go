package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/dchest/captcha"
	"github.com/kataras/iris/v12"
	"github.com/kataras/iris/v12/middleware/cors"
	"github.com/kataras/iris/v12/middleware/recover"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type reason struct {
	Code		uint8
	Category 	string
	Id 			string
	Message 	string
}

func (r reason) MarshalJSON() ([]byte, error) {
	if !GetConfig().Web.FullReason {
		return json.Marshal(r.Code)
	}
	m := iris.Map{
		"code": r.Code,
		"category": r.Category,
		"id": r.Id,
		"message": r.Message,
	}
	return json.Marshal(m)
}

var reasonCounter uint8 = 0

func newReason(path, message string) reason {
	cat, id, ok := strings.Cut(path, ":")
	if !ok {
		cat, id = path, ""
	}
	reasonCounter++
	return reason {
		reasonCounter,
		cat, id,
		message,
	}
}

var (
	reasonObjectNotFound 		= newReason("object:notFound", 			"Cannot locate object with specific id.")
	reasonObjectBadId			= newReason("object:badId", 			"Cannot parse object id.")
	reasonObjectInvalid			= newReason("object:invalid",			"Invalid object structure.")
	reasonAccountInvalidToken	= newReason("account:invalidToken",		"Not logged in or expired token.")
	reasonAccountWrongLogin		= newReason("account:wrongLogin",		"Missing user or incorrect password.")
	reasonAccountWrongPassword	= newReason("account:wrongPassword",	"Incorrect password.")
	reasonAccountWrongCaptcha	= newReason("account:wrongCaptcha",		"Incorrect captcha.")
	reasonUnitExpired 			= newReason("unit:expired", 			"Operation on expired unit.")
	reasonUnitIndexOverflow 	= newReason("unit:indexOverflow",		"Index out of range.")
	reasonUnitTemplateMismatch	= newReason("unit:templateMismatch",	"Code does not match template structure.")
	reasonSystemInternalError	= newReason("system:internalError",		"An internal error has occurred.")
	reasonSystemFeatureDisabled = newReason("system:featureDisabled", 	"Feature is disabled by configuration.")
)

// An abstraction of a http server.
type Server func(host string, port int)

type Stats struct {
	Users	int	`json:"users"`
	Units	int	`json:"units"`
	Records	int	`json:"records"`
}

// Run this server using default configuration.
func (s Server) Run() {
	cfg := GetConfig()
	s(cfg.Http.Host, cfg.Http.Port)
}

// Creates a server using default configuration.
func NewServer() Server {
	fac := NewFactory()
	cfg := GetConfig()
	db, err := NewDatabase()
	queue := NewQueue()

	if err != nil {
		panic(err)
	}

	app := iris.New()
	app.UseRouter(recover.New())
	app.UseRouter(cors.New().
		ExtractOriginFunc(cors.DefaultOriginExtractor).
		ReferrerPolicy(cors.NoReferrerWhenDowngrade).
		AllowOriginFunc(cors.AllowAnyOrigin).
		AllowHeaders("Accept", "Content-Type", "Authorization").
		Handler())
	app.Logger().SetLevel("disable")

	if len(cfg.Web.StaticDir) > 0 {
		var path string
		exe, _ := os.Executable()
		exe, _ = filepath.EvalSymlinks(exe)
		if strings.HasPrefix(exe, "/tmp") {
			// executed with "go run"
			path = cfg.Web.StaticDir
		} else {
			path = filepath.Join(filepath.Dir(exe), cfg.Web.StaticDir)
		}
		app.HandleDir("/", iris.Dir(path))
		app.OnErrorCode(iris.StatusNotFound, func (ctx iris.Context) {
			ctx.Redirect("/404", iris.StatusTemporaryRedirect)
		})
	}

	api_party := app.Party("/_api")

	checkLogin := func(admin bool) func (iris.Context) {
		return func (ctx iris.Context) {
			token := ctx.GetCookie(cfg.Web.CookieName)
			if token == "" {
				token = ctx.GetHeader(cfg.Web.HeaderName)
			}
			if token == "" {
				ctx.StopWithJSON(iris.StatusForbidden, iris.Map {
					"ok": false,
					"reason": reasonAccountInvalidToken,
				})
				return
			}
			user := fac.ParseToken(token, ctx.RemoteAddr())
			if user == nil || (admin && !user.Admin) {
				ctx.StopWithJSON(iris.StatusForbidden, iris.Map {
					"ok": false,
					"reason": reasonAccountInvalidToken,
				})
				return
			}
			ctx.Values().Set("user", user)
			ctx.Next()
		}
	}

	api_party.Post("/account/login", func (ctx iris.Context) {
		if (!cfg.Web.AllowBots) {
			ctx.StopWithJSON(iris.StatusForbidden, iris.Map {
				"ok": false,
				"reason": reasonSystemFeatureDisabled,
			})
			return
		}

		body := struct {
			Name string `json:"name"`
			Password string `json:"password"`
		}{}

		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}

		user := db.FindUserByName(body.Name)
		if user == nil || !user.Verify(body.Password) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongLogin,
			})
			return
		}
		info := user.ToUserInfo()
		token := fac.CreateToken(&info, ctx.RemoteAddr())
		ctx.SetCookieKV(
			cfg.Web.CookieName, token, 
			iris.CookieHTTPOnly(false), 
			iris.CookieExpires(time.Second * time.Duration(cfg.Web.TokenLife)),
		)
		ctx.JSON(iris.Map { 
			"ok": true,
			"data": token,
		})
	})

	api_party.Post("/account/human/login", func (ctx iris.Context) {
		body := struct {
			Name string `json:"name"`
			Password string `json:"password"`
			Captcha	string `json:"captcha"`
			CaptchaId string `json:"captchaId"`
		}{}

		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}

		if !captcha.VerifyString(body.CaptchaId, body.Captcha) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongCaptcha,
			})
			return;
		}

		user := db.FindUserByName(body.Name)
		if user == nil || !user.Verify(body.Password) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongLogin,
			})
			return
		}
		info := user.ToUserInfo()
		token := fac.CreateToken(&info, ctx.RemoteAddr())
		ctx.SetCookieKV(
			cfg.Web.CookieName, token, 
			iris.CookieHTTPOnly(false), 
			iris.CookieExpires(time.Second * time.Duration(cfg.Web.TokenLife)),
		)
		ctx.JSON(iris.Map { 
			"ok": true,
			"data": token,
		})
	})

	api_party.Post("/account/password", checkLogin(false), func (ctx iris.Context) {
		if !cfg.Web.AllowBots {
			ctx.StopWithJSON(iris.StatusForbidden, iris.Map {
				"ok": false,
				"reason": reasonSystemFeatureDisabled,
			})
			return
		}
		
		body := struct {
			OldPassword string `json:"oldPassword"`
			NewPassword string `json:"newPassword"`
		}{}
		
		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}

		id := ctx.Value("user").(*User).Id
		user := db.FindUserById(id)
		if !user.Verify(body.OldPassword) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongPassword,
			})
			return
		}

		hash, _ := argon2id.CreateHash(body.NewPassword, argon2id.DefaultParams)
		db.UpdatePassword(id, hash)
		ctx.JSON(iris.Map {
			"ok": true,
		})
	})

	api_party.Post("/account/human/password", checkLogin(false), func (ctx iris.Context) {
		body := struct {
			OldPassword string `json:"oldPassword"`
			NewPassword string `json:"newPassword"`
			Captcha	string `json:"captcha"`
			CaptchaId string `json:"captchaId"`
		}{}
		
		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}

		if !captcha.VerifyString(body.CaptchaId, body.Captcha) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongCaptcha,
			})
			return
		}

		id := ctx.Value("user").(*User).Id
		user := db.FindUserById(id)
		if !user.Verify(body.OldPassword) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonAccountWrongPassword,
			})
			return
		}

		hash, _ := argon2id.CreateHash(body.NewPassword, argon2id.DefaultParams)
		db.UpdatePassword(id, hash)
		ctx.JSON(iris.Map {
			"ok": true,
		})
	})

	api_party.Get("/account/captcha", func (ctx iris.Context) {
		id := captcha.New()
		ctx.JSON(iris.Map {
			"ok": true,
			"data": id,
		})
	})

	api_party.Get("/account/captcha/{id:string}", func (ctx iris.Context) {
		id := ctx.Params().Get("id")
		ctx.ContentType("image/png")
		captcha.WriteImage(ctx.ResponseWriter(), id, cfg.Web.CaptchaSize[0], cfg.Web.CaptchaSize[1])
	})

	api_party.Get("/units", func (ctx iris.Context) {
		units := db.GetUnitInfos()
		ctx.JSON(iris.Map {
			"ok": true,
			"data": units,
		})
	})

	api_party.Get("/units/{id:string}", checkLogin(false), func (ctx iris.Context) {
		user := ctx.Value("user").(*UserInfo)
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		full := ctx.URLParamBoolDefault("full", false)
		if full {
			if !user.Admin {
				ctx.StopWithStatus(iris.StatusForbidden)
				return
			}
			unit := db.FindEntireUnitById(id)
			if unit == nil {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonObjectNotFound,
				})
				return
			}
			ctx.JSON(iris.Map {
				"ok": true,
				"data": unit,
			})
		} else {
			unit := db.FindPartialUnitById(id)
			if unit == nil {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonObjectNotFound,
				})
				return
			}
			for _, group := range unit.Groups {
				if group == user.Group {
					ctx.JSON(iris.Map {
						"ok": true,
						"data": unit,
					})
					return
				}
			}
			if user.Admin {
				ctx.JSON(iris.Map {
					"ok": true,
					"data": unit,
				})
			} else {
				ctx.StopWithStatus(iris.StatusForbidden)
			}
		}
	})

	api_party.Post("/units", checkLogin(true), func (ctx iris.Context) {
		unit := entireUnit{}
		ctx.ReadJSON(&unit)
		id := db.PutUnit(unit)
		ctx.JSON(iris.Map {
			"ok": true,
			"data": id,
		})
	})

	api_party.Put("/units/{id:string}", checkLogin(true), func (ctx iris.Context) {
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		unit := entireUnit{}
		ctx.ReadJSON(&unit)
		db.UpdateUnit(id, unit)
		ctx.JSON(iris.Map {
			"ok": true,
		})
	})

	api_party.Post("/run/watched/{id:string}", checkLogin(false), func (ctx iris.Context) {
		flusher, ok := ctx.ResponseWriter().Flusher()
		if !ok {
			ctx.StopWithStatus(iris.StatusHTTPVersionNotSupported)
			return
		}
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		body := struct {
			Index	int			`json:"index"`
			Code 	[]string	`json:"code"`
		}{}
		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}
		unit := db.FindUnitWithSingleObjective(id, body.Index)
		if unit == nil {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonObjectNotFound,
			})
			return
		}
		if unit.Deadline.Before(time.Now()) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonUnitExpired,
			})
			return
		}
		if len(unit.Objectives) <= 0 {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonUnitIndexOverflow,
			})
		}
		var code string
		obj := unit.Objectives[0]
		if obj.Template == nil {
			code = body.Code[0]
		} else {
			temp_code, ok := joinCodeTemplate(body.Code, obj.Template)
			if !ok {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonUnitTemplateMismatch,
				})
				return
			}
			code = temp_code
		}
		task := NewTask(obj, code)
		wait := make(chan int)
		task.Watch(func(_ *Task, i int) {
			wait <- i
		})
		go queue.Push(task)
		ctx.Header("Cache-Control", "no-cache")
		ctx.Header("Connection", "keep-alive")
		ctx.ContentType("application/octet-stream")
		for pos := range wait {
			data_json, _ := json.Marshal(struct {
				Id	uint64	`json:"id"`
				Pos	int		`json:"pos"`
			}{
				task.Id, pos,
			})
			ctx.Write(data_json)
			ctx.WriteString("\n")
			flusher.Flush()
			if pos < 0 {
				if task.Result[0].Code != CE {
					passed := 0
					for _, r := range task.Result {
						if r.Code == OK {
							passed++
						}
					}
					db.UpdateRecord(
						ctx.Value("user").(*UserInfo).Id,
						unit.Id,
						body.Index,
						RecordEntry{
							body.Code,
							passed,
							unit.Objectives[0].PointCount,
						},
					)
				}
				res_json, _ := json.Marshal(task.Result)
				ctx.Write(res_json)
				ctx.WriteString("\n")
				flusher.Flush()
				close(wait)
				break
			}
		}
	})

	api_party.Post("/run/blinded/{id:string}", checkLogin(false), func (ctx iris.Context) {
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		body := struct {
			Index	int			`json:"index"`
			Code 	[]string	`json:"code"`
		}{}
		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}
		unit := db.FindUnitWithSingleObjective(id, body.Index)
		if unit == nil {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonObjectNotFound,
			})
			return
		}
		if unit.Deadline.Before(time.Now()) {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonUnitExpired,
			})
			return
		}
		if len(unit.Objectives) <= 0 {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonUnitIndexOverflow,
			})
		}
		var code string
		obj := unit.Objectives[0]
		if obj.Template == nil {
			code = body.Code[0]
		} else {
			temp_code, ok := joinCodeTemplate(body.Code, obj.Template)
			if !ok {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonUnitTemplateMismatch,
				})
				return
			}
			code = temp_code
		}
		task := NewTask(obj, code)
		wait := make(chan int)
		task.Watch(func(_ *Task, i int) {
			wait <- i
		})
		go queue.Push(task)
		for pos := range wait {
			if pos < 0 {
				if task.Result[0].Code != CE {
					passed := 0
					for _, r := range task.Result {
						if r.Code == OK {
							passed++
						}
					}
					db.UpdateRecord(
						ctx.Value("user").(*UserInfo).Id,
						unit.Id,
						body.Index,
						RecordEntry{
							body.Code,
							passed,
							unit.Objectives[0].PointCount,
						},
					)
				}
				ctx.JSON(iris.Map {
					"ok": true,
					"data": task.Result,
				})
				close(wait)
				break
			}
		}
	})

	// used only for debugging
	api_party.Post("/run/priority/{id:string}", checkLogin(true), func (ctx iris.Context) {
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		body := struct {
			Index	int			`json:"index"`
			Code 	[]string	`json:"code"`
		}{}
		if ctx.ReadJSON(&body) != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectInvalid,
			})
			return
		}
		unit := db.FindUnitWithSingleObjective(id, body.Index)
		if unit == nil {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonObjectNotFound,
			})
			return
		}
		// NOTE: no deadline check here as a priority run is for debugging
		if len(unit.Objectives) <= 0 {
			ctx.JSON(iris.Map {
				"ok": false,
				"reason": reasonUnitIndexOverflow,
			})
		}
		var code string
		obj := unit.Objectives[0]
		if obj.Template == nil {
			code = body.Code[0]
		} else {
			temp_code, ok := joinCodeTemplate(body.Code, obj.Template)
			if !ok {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonUnitTemplateMismatch,
				})
				return
			}
			code = temp_code
		}
		task := NewTask(obj, code)
		wait := make(chan int)
		task.Watch(func(_ *Task, i int) {
			wait <- i
		})
		go queue.PushTop(task)
		for pos := range wait {
			if pos < 0 {
				ctx.JSON(iris.Map {
					"ok": true,
					"data": task.Result,
				})
				close(wait)
				break
			}
		}
	})

	api_party.Get("/records", checkLogin(false), func (ctx iris.Context) {
		id := ctx.Value("user").(*UserInfo).Id
		limit := ctx.URLParamIntDefault("limit", 0)
		records := db.RecentRecordsOf(id, limit)
		ctx.JSON(iris.Map {
			"ok": true,
			"data": records,
		})
	})

	api_party.Get("/records/{id:string}", checkLogin(false), func (ctx iris.Context) {
		user_id := ctx.Value("user").(*UserInfo).Id
		unparsed_id := ctx.Params().Get("id")
		id, err := primitive.ObjectIDFromHex(unparsed_id)
		if err != nil {
			ctx.StopWithJSON(iris.StatusBadRequest, iris.Map {
				"ok": false,
				"reason": reasonObjectBadId,
			})
			return
		}
		index := ctx.URLParamIntDefault("index", -1)
		if index < 0 {
			record := db.FindRecord(user_id, id)
			if record == nil {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonObjectNotFound,
				})
				return
			}
			ctx.JSON(iris.Map {
				"ok": true,
				"data": *record,
			})
		} else {
			entry := db.GetRecordEntry(user_id, id, index)
			if entry == nil {
				ctx.JSON(iris.Map {
					"ok": false,
					"reason": reasonObjectNotFound,
				})
				return
			}
			ctx.JSON(iris.Map {
				"ok": true,
				"data": *entry,
			})
		}
	})

	api_party.Get("/groups", checkLogin(true), func(ctx iris.Context) {
		groups := db.ListGroups()
		if groups == nil {
			ctx.JSON(iris.Map {
				"ok": false,
				"data": reasonSystemInternalError,
			})
			return
		}
		ctx.JSON(iris.Map {
			"ok": true,
			"data": groups,
		})
	})

	api_party.Get("/stat", func (ctx iris.Context) {
		stat := db.Stats()
		ctx.JSON(iris.Map {
			"ok": true,
			"data": stat,
		})
	})

	return func(host string, port int) {
		go queue.Launch()
		app.Listen(fmt.Sprintf("%s:%d", host, port))
	}
}