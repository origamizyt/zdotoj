#! /usr/bin/ruby

require 'json'
require 'io/console'
require 'toml-rb'

json = File.open("dist/config.scheme.json") { |f|
    JSON.load(f)
}

def ask(j, name)
    puts "[#{name}]"
    if j.key?('$skip')
        puts "Skip: #{j['$skip']}"
        puts
        return j['$default'] # no type check
    end
    while true
        puts "· #{j['$prompt']}"
        if j.key?('$default')
            puts "(default: #{j['$default']})"
        end
        if j['$type'] == 'password'
            v = STDIN.noecho(&:gets).chomp
        else
            v = gets.chomp
        end
        if v.length == 0 
            if j.key?('$default')
                return j['$default']
            end
            puts "Error: value required for mandatory field.\n"
            next
        end
        case j['$type']
        when 'int'
            v = v.to_i
        when 'pint'
            v = v.to_i
            if v <= 0
                puts "Error: a positive value is required.\n"
                next
            end
        when 'boolean'
            if v == 'true'
                v = true
            elsif v == 'false'
                v = false
            else
                puts "Error: \"true\" / \"false\" is required.\n"
                next
            end
        end
        puts
        return v
    end
end

def iterate(j, v, name="")
    if name[0] == '.' 
        name = name[1..]
    end
    deep = true
    j.each_key { |key| 
        if key[0] != '$' 
            deep = false
            break
        end
    }
    if deep 
        return ask j, name
    else 
        j.each { |key, value|
            v[key] = iterate(value, Hash.new, "#{name}.#{key}")
        }
        return v
    end
end

puts "💎 Z.OJ Configuration Script 💎"
puts "Enter nothing to use default value."
puts

v = iterate json, Hash.new
File.open("dist/config.toml", "w") { |f|
    f << TomlRB.dump(v)
}
puts "Config written to dist/config.toml"