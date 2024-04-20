package main

import (
	"os"
	"slices"
	"strings"
	"sync"
	"time"
)

const (
	LanguageC	uint8	= iota
	LanguageCpp
)

var judgeModeFlags = newUint16Flags()

var (
	// (0b001). Judge in strict mode. Mutually exclusive with "Special".
	Strict	= judgeModeFlags.next()
	// (0b010). Use SpecialJudge script instead of built-in judgers. Mutually exclusive with "Strict".
	Special	= judgeModeFlags.next()
	// (0b100). Use RandomJudge script instead of predefined data points.
	Random	= judgeModeFlags.next()
)

// A data point in built-in judge mode.
type DataPoint struct {
	// String to be written to program's standard input.
	In 			string	`json:"in"`
	// String to expect from program's standard output.
	Out 		string	`json:"out"`
	// Time limit, in seconds.
	TimeLimit 	int		`json:"timeLimit"`
	// Memory limit, in bytes.
	MemoryLimit int		`json:"memoryLimit"`
}

type Region struct {
	// Content of the area.
	Content		string		`json:"content"`
	// Whether the area is editable by user.
	Editable	bool		`json:"editable"`
	// Indentation of the area.
	Indent		int			`json:"indent"`
}

// An objective without points / scripts.
type ObjectiveInfo struct {
	// Name of objective.
	Name 		string		`json:"name"`
	// Description of objective.
	Description string		`json:"description"`
	// Difficulty within 0-10.
	Difficulty	int			`json:"difficulty"`
	// Template to restrict user input area.
	Template	[]Region	`json:"template"`
	// Judging mode.
	Mode		uint16		`json:"mode"`
	// Programming language.
	Language	uint8		`json:"language"`
	// Amount of points. In RandomJudge mode, this number indicates how many points the script should generate.
	PointCount	int			`json:"pointCount"`
}

// An objective is a single problem to be solved.
type Objective struct {
	// Name of objective.
	Name 		string		`json:"name"`
	// Description of objective.
	Description string		`json:"description"`
	// Difficulty within 0-10.
	Difficulty	int			`json:"difficulty"`
	// Template to restrict user input area.
	Template	[]Region	`json:"template"`
	// Judging mode.
	Mode		uint16		`json:"mode"`
	// Programming language.
	Language	uint8		`json:"language"`
	// Amount of points. In RandomJudge mode, this number indicates how many points the script should generate.
	PointCount	int			`json:"pointCount"`
	// Data points. Nil in RandomJudge mode.
	Points		[]DataPoint	`json:"points"`
	// RandomJudge script. Empty string if disabled.
	RScript		string		`json:"rScript"`
	// SpecialJudge script. Empty string if disabled.
	SScript		string		`json:"sScript"`
}

// Unit without the set of objectives.
type UnitInfo struct {
	// Unit id.
	Id 				ID					`json:"id" bson:"_id"`
	// Name of unit.
	Name 			string				`json:"name"`
	// Creation time of unit.
	Time 			time.Time			`json:"time"`
	// Deadline after which the unit would be frozen.
	Deadline 		time.Time			`json:"deadline"`
	// Groups allowed. Nil allows arbitrary groups.
	Groups			[]string			`json:"groups"`
	// Descriptive tags. Should not be nil.
	Tags			[]string			`json:"tags"`
	// Average difficulty of the objectives.
	Difficulty		float32				`json:"difficulty"`
	// Amount of objectives.
	ObjectiveCount 	uint16				`json:"objectiveCount"`
}

// Unit including the set of objectives.
type Unit[T ObjectiveInfo | Objective] struct {
	// Unit id.
	Id 				ID					`json:"id" bson:"_id"`
	// Name of unit.
	Name 			string				`json:"name"`
	// Creation time of unit.
	Time 			time.Time			`json:"time"`
	// Deadline after which the unit would be frozen.
	Deadline 		time.Time			`json:"deadline"`
	// Groups allowed. Nil allows arbitrary groups.
	Groups			[]string			`json:"groups"`
	// Descriptive tags. Should not be nil.
	Tags			[]string			`json:"tags"`
	// Objectives in this unit.
	Objectives 		[]T					`json:"objectives"`
}

type entireUnit = Unit[Objective]

type partialUnit = Unit[ObjectiveInfo]

// Result.Data of wrong answer (WA).
type WAResult struct {
	ExecResult
	// User's standard output.
	Got			string	`json:"got"`
	// Expected standard output.
	Expected	string	`json:"expected"`
}

// Result of an objective run.
type Result struct {
	// Result code.
	Code int	`json:"code"`
	// Result data.
	Data any	`json:"data"`
}

const (
	// compile / judge:

	IE	int = -3 // Internal error.
	CE	int = -2 // Compile error.
	WA 	int = -1 // Wrong answer.

	// sandbox.c compatible codes:

	OK 	int = 0 // Passed.
	RE 	int = 1 // Runtime error.
	TLE int = 2 // Time limit exceeded.
	MLE	int = 3 // Memory limit exceeded.
	SE	int = 4 // Security error.
)

// Run this objective against given code.
func (o *Objective) Run(code string) []Result {
	path, compile_result := Compile(code, o.Language)
	if !compile_result.Ok {
		return []Result {
			{
				Code: CE,
				Data: compile_result,
			},
		}
	}
	defer os.Remove(path)

	results := make([]Result, o.PointCount)

	runOne := func(i int) {
		var point DataPoint
		if !judgeModeFlags.check(o.Mode, Random) {
			point = o.Points[i]
		} else {
			ok, point_temp := InvokeRandomJudgeScript(o.RScript, i)
			if !ok {
				results[i] = Result {
					Code: IE,
					Data: "RandomJudge",
				}
				return
			}
			point = point_temp
		}
		output, execution_result := Execute(path, point)
		if execution_result.Code != OK {
			results[i] = Result {
				Code: execution_result.Code,
				Data: execution_result,
			}
			return
		}
		if judgeModeFlags.check(o.Mode, Strict) {
			if strictJudge(output, point.Out) {
				results[i] = Result {
					Code: OK,
					Data: execution_result,
				}
			} else {
				results[i] = Result {
					Code: WA,
					Data: WAResult { execution_result, output, point.Out },
				}
			}
		} else if judgeModeFlags.check(o.Mode, Special) {
			ok, pass := InvokeSpecialJudgeScript(o.SScript, output, point.Out, i)
			if ok {
				if pass {
					results[i] = Result {
						Code: OK,
						Data: execution_result,
					}
				} else {
					results[i] = Result {
						Code: WA,
						Data: WAResult { execution_result, output, point.Out },
					}
				}
			} else {
				results[i] = Result {
					Code: IE,
					Data: "SpecialJudge",
				}
			}
		} else {
			if laxJudge(output, point.Out) {
				results[i] = Result {
					Code: OK,
					Data: execution_result,
				}
			} else {
				results[i] = Result {
					Code: WA,
					Data: WAResult { execution_result, output, point.Out },
				}
			}
		}
	}

	defer ClearAuxData()
	
	if GetConfig().Core.AsyncExecute {
		wg := sync.WaitGroup{}
		wg.Add(o.PointCount)
		for i := 0; i < o.PointCount; i++ {
			go func (x int) {
				defer wg.Done()
				runOne(x)
			} (i) // BUG: signal receiver does not run in executing thread
		}
		wg.Wait()
	} else {
		for i := 0; i < o.PointCount; i++ {
			runOne(i)
		}
	}

	return results
}

func laxJudge(got, expected string) bool { // default
	got_lines := strings.Split(strings.Trim(got, " \n"), "\n")
	expected_lines := strings.Split(strings.Trim(expected, " \n"), "\n")
	
	remover := func (line string) bool { 
		return len(strings.Trim(line, " ")) <= 0
	}
	got_lines = slices.DeleteFunc(got_lines, remover)
	expected_lines = slices.DeleteFunc(expected_lines, remover)
	
	if len(got_lines) != len(expected_lines) { return false }

	for i := 0; i < len(got_lines); i++ {
		if strings.Trim(got_lines[i], " ") != strings.Trim(expected_lines[i], " ") {
			return false
		}
	}

	return true
}

func strictJudge(got, expected string) bool {
	return got == expected
}