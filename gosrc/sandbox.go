package main

/*
#cgo CFLAGS: -I.
#cgo LDFLAGS: -Wl,--allow-multiple-definition
#include <stdlib.h>
#include "sandbox.c"
*/
import "C"

import (
	"os"
	"unsafe"
)

// Represents the result of a native execution.
type ExecResult struct {
	// Status code.
	Code       int		`json:"code"`
	// Time cost in seconds.
	ExecTime   float32	`json:"execTime"`
	// Memory usage in bytes.
	ExecMemory int		`json:"execMemory"`
	// Syscall number, if .Code == SE.
	Syscall    int		`json:"syscall"`
	// Termination signal number, if .Code == RE.
	TermSig    int		`json:"termsig"`
}

// Executes given program in sandbox. Time cost, memory usage and system calls are monitored.
func Execute(
	path string,
	point DataPoint,
) (string, ExecResult) {
	disallowedSyscall := GetConfig().Core.DisallowedSyscall

	stdin, stdin_parent, _ := os.Pipe()
	stdout_parent, stdout, _ := os.Pipe()
	defer stdout_parent.Close()
	stdin_parent.WriteString(point.In)
	stdin_parent.Close()

	cfg := (*C.struct_exec_cfg)(C.malloc(C.SIZEOFCFG))
	cfg.stdin_fd = C.int(stdin.Fd())
	cfg.stdout_fd = C.int(stdout.Fd())
	cfg.time_limit = C.int(point.TimeLimit)
	cfg.memory_limit = C.int(point.MemoryLimit)
	cfg.disallowed_syscall = (*C.int)(&disallowedSyscall[0])
	cfg.disallowed_syscall_count = C.int(len(disallowedSyscall))
	defer C.free(unsafe.Pointer(cfg))

	path_cstr := C.CString(path)
	defer C.free(unsafe.Pointer(path_cstr))

	res_ptr := C.execute(path_cstr, cfg)
	defer C.free(unsafe.Pointer(res_ptr))
	stdin.Close()
	stdout.Close()

	if res_ptr.code == C.RC_OK {
		output_bytes := make([]byte, 0)
		for {
			chunk := make([]byte, 1024)
			n, _ := stdout_parent.Read(chunk)
			if n == 0 {
				break
			}
			output_bytes = append(output_bytes, chunk[:n]...)
			if n < 1024 {
				break
			}
		}
		return string(output_bytes), ExecResult{
			Code:       int(res_ptr.code),
			ExecTime:   float32(res_ptr.exec_time),
			ExecMemory: int(res_ptr.exec_mem),
		}
	}

	return "", ExecResult{
		Code:    int(res_ptr.code),
		Syscall: int(res_ptr.syscall),
		TermSig: int(res_ptr.termsig),
	}
}
