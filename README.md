<p align="center">
    <img alt="Z.OJ" src="static/ZOJ_Logo_v2.png" width="50" />
</p>
<h1 align="center">
    Z.OJ - 轻量级可定制评测系统
</h1>

<p align="center" style='color: #aaa'>    
    <b>Version 1.0.0-beta</b>
</p>

## 🚀 安装

先决条件（括号内为作者使用的版本）:
- Linux
- go (1.21)
- node (21.6.2), npm (10.5.0)
- ruby (3.0.6p216)

由于 `gatsby-plugin-transition-link` 依赖项问题，使用 `--legacy-peer-deps` 安装 JavaScript 依赖：
``` 
$ npm install --legacy-peer-deps
```

初始化配置文件：
```
$ gem install json toml-rb
$ ruby bin/init.rb
```

安装：
```
$ make
$ sudo make install
```

Z.OJ 可执行文件 `z.oj` 将安装到 `/usr/local/bin` 目录下。

## MagicJudge🪄

RandomJudge 和 SpecialJudge 是内置的两个基于 Lua 的评测组件，其中 RandomJudge 负责数据点的随机生成，而 SpecialJudge 负责比对用户输出与样例输出。

### RandomJudge

考虑一个 A+B 问题，用户获得两个整数输入，输出一个整数。以下是一个用于此题目的 RandomJudge 脚本：
```lua
a = math.random(-100000, 100000)
b = math.random(-100000, 100000)
c = a + b

Z.feed(string.format("%d %d\n", a, b))
Z.expect(string.format("%d", c))
```

这个脚本生成了两个 [-100000, 100000] 内的整数并使用 `Z.feed` 以及 `Z.expect` 指定了输入与输出。

> 注：在使用 `math.random` 时无需使用 `math.randomseed` 设定种子——在 Lua 环境初始化时已经完成了。

Lua 的内置库只有三个可用：`table`，`string`，`math`。此外，有以下额外成员：

| 成员 | 描述 |
| --- | --- |
| `ostime()` | 与 `os.time` 相同 |
| `randomstring(number[, string])` | 生成指定长度的随机字符串。第二个参数指定字符的范围，若为 nil 则范围为字母与数字 |
| `setauxdata(object)` | 设置辅助数据，在两个脚本组件中共用 |
| `getauxdata()` | 获取辅助数据 |
| `Z.feed(string)` | 向虚拟的标准输入流中写入内容，可以重复调用 |
| `Z.expect(string)` | 向样例输出添加内容，可以重复调用 |
| `Z.limit(number, number)` | 指定时间（秒）与内存（字节）限制 |
| `Z.index: number` | 当前生成数据点的索引（0开始） |

### SpecialJudge

> 注意：SpecialJudge 与 Strict 模式不兼容，如果同时指定将优先使用 Strict。

考虑一个随机生成表达式的问题：用户需要随机生成一个非负整数加法表达式并输出。以下是一个用于此题目的 SpecialJudge 脚本：
```lua
a, b, c = string.match(Z.got, "^%s*(%d+)%+(%d+)=(%d+)%s*$")
if a == nil or b == nil or c == nil then
    Z.match(false)
end
a, b, c = tonumber(a), tonumber(b), tonumber(c)
Z.match(a + b == c)
```

以上脚本忽略了前后的空白字符并通过 Regular Expressions 处理输出。以上代码并未使用数据点的样例输出。

SpecialJudge 中的 `Z` 表成员与 RandomJudge 不同：

| 成员 | 描述 |
| --- | --- |
| `Z.got: string` | 标准输出流内容 |
| `Z.expected: string` | 样例输出内容 |
| `Z.match(boolean)` | 设置评测结果，调用后将退出脚本执行 |
| `Z.index: number` | 当前数据点的索引（0开始） |

与 RandomJudge 一同使用时，可以使用 Auxiliary Data。考虑一个将输入分解为两个数乘积（不可以为 1）的题目，以下为 RandomJudge 脚本：
```lua
function valid(n)
    for i = 2, n-1 do
        if n % i == 0 then
            return true
        end
    end
    return false
end

while (true) do
    n = math.random(100, 100000)
    if valid(n) then
        break
    end
end

setauxdata(n)
Z.feed(string.format("%d\n", n))
-- using SpecialJudge
-- so Z.expect is useless
```

SpecialJudge 脚本：
```lua
n = getauxdata()
a, b = string.match(Z.got, "^%s*(%d+)%s*(%d+)%s*$")
if a == nil or b == nil then
    Z.match(false)
end
a, b = tonumber(a), tonumber(b)
if a == 1 or b == 1 then
    Z.match(false)
end
Z.match(a * b == n)
```

Auxiliary Data 也可用于不同数据点的 RandomJudge / SpecialJudge 纵向交流。

> 注意：当未设置 Auxiliary Data 时不要尝试调用 `getauxdata`，这会导致评测结果为 IE。单个问题执行完毕后会清空 Auxiliary Data。
## 💻 配置

配置文件 `config.toml` 位于 `dist` 目录下。以下是可用的配置项目：

```go
type Config struct {
    Core struct {
        // 临时文件目录
        TemporaryFolder   string
        // GNU 编译器位置
        GccPath           string
        // 禁止的系统调用号
        DisallowedSyscall []int32
        // 是否多线程运行
        // 此功能尚未开发完成，请勿设置为 true。
        AsyncExecute      bool
    }
    Database struct {
        // 数据库地址
        Host    string
        // 数据库端口
        Port    int
        // 数据库用户
        // 不推荐使用 root 用户。
        User    string
        // 用户密码
        Pass    string
        // 连接字符串格式
        // 一般无需修改此项。
        Format  string
    }
    Http struct {
        // 绑定地址
        Host  string
        // 绑定端口
        Port  string
    }
    Web struct {
        // Token 过期时间 (秒)
        TokenLife   int
        // Cookie 名称
        CookieName  string
        // Header 名称
        HeaderName  string
        // 是否使用详细的错误信息
        // 如果使用内置的 UI 务必设置为 true。
        FullReason  bool
        // 静态文件目录。
        // 如果忽略则不挂载静态文件。
        StaticDir   string
    }
}
```

## 🌀 扩展

### 添加语言 or 编译器

可以通过 Go Modules 设定语言或编译器。在 `gosrc` 目录下创建 `go_compiler.go` 文件，写入以下内容（假设正在创建 Go 编译器）：
```go
package main

import (
    "os"
    "os/exec"
)

const LanguageGo uint8 = 2

func init() {
    ExtendCompiler(LanguageGo, CompileGo)
}

func CompileGo(code string) (string, CompileResult) {
    src_path, exe_path := RandomFilePair(GetConfig().Core.TemporaryFolder)
	os.WriteFile(src_path, ([]byte)(code), 0o777)
	defer os.Remove(src_path)
    cmd := exec.Command("/usr/bin/go", "build", "-o", exe_path, src_path)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", CompileResult{
			Ok:       false,
			Compiler: "go",
			ExitCode: cmd.ProcessState.ExitCode(),
			Error:    string(output),
		}
	}
	return exe_path, CompileResult{
		Ok:       true,
		Compiler: "go",
		ExitCode: 0,
		Error:    "",
	}
}
```

在 `ExtendCompiler` 中指定一个已经存在的语言可以覆盖原有的编译器。

如果要添加解释型语言支持，shebang 行是一种可行的做法：
```go
package main

import (
    "os"
    "os/exec"
)

const LanguagePython uint8 = 3

func init() {
    ExtendCompiler(LanguagePython, CompilePython)
}

func CompilePython(code string) (string, CompileResult) {
    exe_path := RandomFile(GetConfig().Core.TemporaryFolder)
    fp, _ := os.Create(exe_path)
    fp.WriteString("#! /usr/bin/python3\n\n")
    fp.WriteString(code)
    fp.Close()
	return exe_path, CompileResult{
		Ok:       true,
		Compiler: "",
		ExitCode: 0,
		Error:    "",
	}
}
```

默认的 UI 中只有对于 C 与 C++ 语言的高亮提示支持。要添加对新语言的支持，找到 `src/frontend/api.ts` 中的以下行：
```ts
export enum Language {
    C, CPP
}

// ...

const languages: LanguageSpec[] = [
    {
        id: 'c',
        name: 'C'
    },
    {
        id: 'cpp',
        name: 'C++'
    }
];
```

并在枚举和数组中添加你的语言（注意索引顺序）。注意确保 `id` 指定的语言名称与 CodeMirror 中的定义一致，否则将无法正确显示代码高亮。

## 👻 管理脚本

使用 `bin/manage_users.rb` 脚本进行用户管理。
```
$ gem install json toml-rb argon2
$ gem install mongo -v '~> 2'
$ ruby bin/manage_users.rb
```

> 注：此脚本直接读取 `dist/config.toml` 中的数据库配置。

使用 `bin/add_users_batch.rb` 批量添加用户。
```
$ echo "Name1,Group1,false,Pass1" >> users.csv
$ echo "Name2,Group2,false,Pass2" >> users.csv
$ ruby bin/add_users_batch.rb users.csv
```

使用 `bin/export_records.rb` 导出成绩。
```
$ ruby bin/export_records.rb
...
Path of CSV file to write to:
export.csv
CSV exported to export.csv.
$ cat export.csv
user1,0.8,1.6,2.8
user2,0.6,1.5,2.4
...
```

> 注：每个数字是题目通过率乘以难度。