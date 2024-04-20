package main

import (
	"errors"
	"os"
	"os/exec"
)

func init() {
	tmp_folder := GetConfig().Core.TemporaryFolder
	os.Mkdir(tmp_folder, 0o777)
}

// Specified compiler is missing from registry.
var ErrMissingCompiler = errors.New("specified compiler not found")

// Represents the result of a native compile.
type CompileResult struct {
	// True if compile succeeded.
	Ok       bool   `json:"ok"`
	// Unique identifier per compiler.
	Compiler string `json:"compiler"`
	// Compiler program exit code.
	ExitCode int    `json:"exitCode"`
	// Standard output / error from compiler.
	Error    string `json:"error"`
}

// Compiler function.
type Compiler func(code string) (string, CompileResult)

var compilerMap = map[uint8]Compiler {
	LanguageC: func(code string) (string, CompileResult) {
		return CompileGCC(code, false)
	},
	LanguageCpp: func(code string) (string, CompileResult) {
		return CompileGCC(code, true)
	},
}

// Compiler given code using language-specific compiler.
func Compile(code string, lang uint8) (string, CompileResult) {
	for stored_lang, compiler := range compilerMap {
		if stored_lang == lang {
			return compiler(code)
		}
	}
	panic(ErrMissingCompiler)
}

// Extend compiler registry with custom compiler.
func ExtendCompiler(lang uint8, compiler Compiler) {
	compilerMap[lang] = compiler
}

// Use GCC to compile code. Returns output path and result.
func CompileGCC(code string, cpp bool) (string, CompileResult) {
	src_path, exe_path := RandomFilePair(GetConfig().Core.TemporaryFolder)
	os.WriteFile(src_path, ([]byte)(code), 0o777)
	defer os.Remove(src_path)
	var cmd *exec.Cmd
	if cpp {
		cmd = exec.Command(GetConfig().Core.GccPath, "-x", "c++", "-o", exe_path, src_path, "-lstdc++")
	} else {
		cmd = exec.Command(GetConfig().Core.GccPath, "-x", "c", "-o", exe_path, src_path)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", CompileResult{
			Ok:       false,
			Compiler: "gcc",
			ExitCode: cmd.ProcessState.ExitCode(),
			Error:    string(output),
		}
	}
	return exe_path, CompileResult{
		Ok:       true,
		Compiler: "gcc",
		ExitCode: 0,
		Error:    "",
	}
}