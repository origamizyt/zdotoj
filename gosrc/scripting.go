package main

import (
	"context"
	"math/rand"
	"time"

	"github.com/yuin/gopher-lua"
)

var rjState *lua.LState = lua.NewState(lua.Options{ SkipOpenLibs: true })
var sjState *lua.LState = lua.NewState(lua.Options{ SkipOpenLibs: true })
var auxData lua.LValue = nil

func init() {
	if err := loadMinimalLibs(rjState); err != nil {
		panic(err);
	}
	addHelpFunctions(rjState);
	rjState.DoString("math.randomseed(ostime())")
	if err := loadMinimalLibs(sjState); err != nil {
		panic(err);
	}
	addHelpFunctions(sjState);
	sjState.DoString("math.randomseed(ostime())")
}

var helperFunctions = map[string] lua.LGFunction {
	"randomstring": func(L *lua.LState) int {
		size := L.ToInt(1)
		candidates_lua := L.Get(2)
		var candidates string
		if candidates_lua == lua.LNil {
			candidates = randomNameCandidates
		} else {
			candidates = lua.LVAsString(candidates_lua)
			if candidates == "" { 
				candidates = randomNameCandidates
			}
		}
		r := make([]byte, 0, size)
		for i := 0; i < size; i++ {
			idx := rand.Intn(len(candidates))
			r = append(r, candidates[idx])
		}
		L.Push(lua.LString(r))
		return 1
	},
	"ostime": func(L *lua.LState) int {
		L.Push(lua.LNumber(time.Now().Unix()))
		return 1
	},
	"setauxdata": func(L *lua.LState) int {
		auxData = L.Get(1)
		return 0
	},
	"getauxdata": func(L *lua.LState) int {
		L.Push(auxData)
		return 1
	},
}

func addHelpFunctions(L *lua.LState) {
	for k, v := range helperFunctions {
		L.SetGlobal(k, L.NewFunction(v))
	}
}

func loadMinimalLibs(L *lua.LState) error {
	for _, pair := range []struct {
        n string
        f lua.LGFunction
    }{
        {lua.LoadLibName, lua.OpenPackage}, // Must be first
        {lua.BaseLibName, lua.OpenBase},
        {lua.TabLibName, lua.OpenTable},
		{lua.StringLibName, lua.OpenString},
		{lua.MathLibName, lua.OpenMath},
    } {
        if err := L.CallByParam(lua.P{
            Fn:      L.NewFunction(pair.f),
            NRet:    0,
            Protect: true,
        }, lua.LString(pair.n)); err != nil {
            return err
        }
    }
	return nil
}

// Invoke RandomJudge script.
func InvokeRandomJudgeScript(script string, index int) (bool, DataPoint) {
	L := rjState
	point := DataPoint{}
	table_Z := L.NewTable()
	func_feed := func (L *lua.LState) int {
		point.In += L.ToString(1)
		return 0
	}
	func_expect := func (L *lua.LState) int {
		point.Out += L.ToString(1)
		return 0
	}
	func_limit := func (L *lua.LState) int {
		point.TimeLimit = L.ToInt(1)
		point.MemoryLimit = L.ToInt(2)
		return 0
	}
	table_Z.RawSetString("feed", L.NewFunction(func_feed))
	table_Z.RawSetString("expect", L.NewFunction(func_expect))
	table_Z.RawSetString("limit", L.NewFunction(func_limit))
	table_Z.RawSetString("index", lua.LNumber(index))
	L.SetGlobal("Z", table_Z)
	if err := L.DoString(script); err != nil {
		return false, DataPoint{}
	}
	return true, point
}

// Invoke SpecialJudge script.
func InvokeSpecialJudgeScript(script string, got string, expected string, index int) (bool, bool) {
	L := sjState
	result, exit := false, false
	table_Z := L.NewTable()
	ctx, cancel := context.WithCancel(context.Background())
	L.SetContext(ctx)
	func_match := func (L *lua.LState) int {
		defer cancel()
		result = L.ToBool(1)
		exit = true
		return 0
	}
	table_Z.RawSetString("got", lua.LString(got))
	table_Z.RawSetString("expected", lua.LString(expected))
	table_Z.RawSetString("match", L.NewFunction(func_match))
	table_Z.RawSetString("index", lua.LNumber(index))
	L.SetGlobal("Z", table_Z)
	if err := L.DoString(script); !exit && err != nil {
		return false, false
	}
	return true, result
}

// Clears auxiliary data.
func ClearAuxData() {
	auxData = nil
}