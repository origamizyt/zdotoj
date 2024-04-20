package main

import (
	"math/rand"
	"reflect"
	"strings"
	"path/filepath"

	"go.mongodb.org/mongo-driver/bson"
)

const INDENT = 4

const randomNameCandidates = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

// Random name of given size, consisting of alphanumeric characters.
func RandomName(size int) string {
	str := make([]byte, size)
	for i := 0; i < size; i++ {
		str = append(str, randomNameCandidates[rand.Intn(len(randomNameCandidates))])
	}
	return string(str)
}

// Random file name in given folder.
func RandomFile(base string) string {
	return removeNullChars(filepath.Join(base, RandomName(8)))
}

// Two random file names in given folder.
func RandomFilePair(base string) (string, string) {
	return RandomFile(base), RandomFile(base)
}

func removeNullChars(s string) string {
	return strings.Join(strings.Split(s, "\x00"), "")
}

func toBsonMap(v any, withoutId bool) bson.M {
	val := reflect.ValueOf(v)
	typ := val.Type()
	bson_map := make(bson.M)
	for i := 0; i < val.NumField(); i++ {
		if withoutId && typ.Field(i).Name == "Id" { continue }
		if val.Field(i).CanInterface() {
			bson_map[strings.ToLower(typ.Field(i).Name)] = val.Field(i).Interface()
		}
	}
	return bson_map
}

func joinCodeTemplate(code []string, template []Region) (string, bool) {
	count := 0
	for _, region := range template {
		if region.Editable { count++ }
	}
	if count != len(code) { return "", false }
	buf := strings.Builder{}
	index := 0
	for _, region := range template {
		for i := 0; i < region.Indent * INDENT; i++ {
			buf.WriteString(" ");
		}
		if region.Editable { 
			buf.WriteString(code[index])
			buf.WriteByte('\n')
			index++
		} else {
			buf.WriteString(region.Content)
			buf.WriteByte('\n')
		}
	}
	return buf.String(), true
}

type uint16Flags struct {
	count int
	currentFlag int
}

func newUint16Flags() uint16Flags {
	return uint16Flags{ 0, 0b1 }
}

func (f *uint16Flags) next() uint16 {
	if f.count >= 16 {
		return 0 // don't panic, as this is private
	}
	f.count++
	val := f.currentFlag
	f.currentFlag <<= 1
	return uint16(val)
}

func (f uint16Flags) check(val uint16, flags uint16) bool {
	return val & flags == flags
}