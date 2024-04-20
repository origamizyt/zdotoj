package main

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/BurntSushi/toml"
)

// Core configuration section.
type CoreConfig struct {
	TemporaryFolder		string
	GccPath 			string
	DisallowedSyscall	[]int32
	AsyncExecute		bool
}

// Database configuration section.
type DatabaseConfig struct {
	Host 	string
	Port 	int
	User 	string
	Pass 	string
	Format 	string
}

// Server configuration section.
type HttpConfig struct {
	Host	string
	Port	int
}

// Web configuration section.
type WebConfig struct {
	TokenLife	int
	CookieName	string
	HeaderName	string
	FullReason	bool
	StaticDir	string
	CaptchaSize	[2]int
	AllowBots	bool
}

// Root configuration section.
type Config struct {
	Core		CoreConfig
	Database	DatabaseConfig
	Http		HttpConfig
	Web			WebConfig
}

var configCache *Config = nil

// Get global configuration instance.
func GetConfig() *Config {
	if configCache == nil {
		path, ok := os.LookupEnv("ZOJ_CONFIG")
		if !ok {
			exe, _ := os.Executable()
			exe, _ = filepath.EvalSymlinks(exe)
			if strings.HasPrefix(exe, "/tmp") {
				// executed with "go run"
				path = "./config.toml"
			} else {
				path = filepath.Join(filepath.Dir(exe), "config.toml")
			}
		}
		raw_config, _ := os.ReadFile(path)
		configCache = new(Config)
		toml.Unmarshal(raw_config, configCache)
	}
	return configCache
}