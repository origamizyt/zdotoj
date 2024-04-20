package main

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/alexedwards/argon2id"
	"golang.org/x/crypto/hkdf"
)

// Displayed user information.
type UserInfo struct {
	Id		ID		`json:"id" bson:"_id"`
	Name	string	`json:"name"`
	Group	string	`json:"group"`
	Admin	bool	`json:"admin"`
}

// Full user data model, compatible with UserInfo.
type User struct {
	Id			ID	`bson:"_id"`
	Name		string
	Group		string
	Admin		bool
	Password	string
}

// Convert User to UserInfo.
func (u *User) ToUserInfo() UserInfo {
	return UserInfo{
		Id: u.Id,
		Name: u.Name,
		Group: u.Group,
		Admin: u.Admin,
	}
}

// Verifies stored password hash against given plaintext password.
func (u *User) Verify(password string) bool {
	match, err := argon2id.ComparePasswordAndHash(password, u.Password)
	return match && err == nil
}

type payload struct {
	Address	string		`json:"address"`
	Expires	int64		`json:"expires"`
	Subject	UserInfo	`json:"subject"`
}

func deriveKey(material, salt []byte) ([]byte, []byte) {
	if salt == nil {
		salt = make([]byte, 16)
		rand.Read(salt)
	}
	key := make([]byte, 32)
	hkdf.New(crypto.SHA512.New, material, salt, nil).Read(key)
	return key, salt
}

// Factory that creates token based on user infos and ip.
type TokenFactory struct {
	key 	[]byte
	Life 	int
}

// Creates a new factory using a random key.
func NewFactory() *TokenFactory {
	fac := &TokenFactory {
		key: make([]byte, 32),
		Life: GetConfig().Web.TokenLife,
	}
	rand.Read(fac.key)
	return fac
}

// Creates a token that authenticates given user and address.
func (f *TokenFactory) CreateToken(user *UserInfo, ip string) string {
	payload := payload{
		Address: ip,
		Expires: time.Now().UnixMilli() + int64(f.Life * 1000),
		Subject: *user,
	}
	payload_bytes, _ := json.Marshal(payload)

	key, salt := deriveKey(f.key, nil)
	sig := hmac.New(crypto.SHA384.New, key).Sum(payload_bytes)[len(payload_bytes):]
	sig = append(salt, sig...)

	sig_b64 := base64.RawURLEncoding.EncodeToString(sig)
	payload_b64 := base64.RawURLEncoding.EncodeToString(payload_bytes)

	return sig_b64 + "." + payload_b64
} 

// Verifies the validity of given token and address, returning user info if valid.
func (f *TokenFactory) ParseToken(token, ip string) *UserInfo {
	parts := strings.Split(token, ".")
	sig, _ := base64.RawURLEncoding.DecodeString(parts[0])
	payload_bytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
	salt, sig := sig[:16], sig[16:]

	key, _ := deriveKey(f.key, salt)
	computed_sig := hmac.New(crypto.SHA384.New, key).Sum(payload_bytes)[len(payload_bytes):]
	if !hmac.Equal(computed_sig, sig) {
		return nil
	}

	var payload payload
	if err := json.Unmarshal(payload_bytes, &payload); err != nil {
		fmt.Println(err)
	}
	if payload.Address != ip { return nil }
	if time.UnixMilli(payload.Expires).Before(time.Now()) { return nil }
	
	return &payload.Subject
}