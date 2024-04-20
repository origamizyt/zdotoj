package main

import (
	"fmt"
)

func main() {
	cfg := GetConfig()
	fmt.Println("💎 Z.OJ Version: 1.0.0-beta 💎")
	fmt.Println("> Configuration:", cfg.Location)
	fmt.Println("> Go server:     github.com/kataras/iris/v12")
	fmt.Println()
	server := NewServer()
	server.Run()
}