#! /usr/bin/ruby

require 'csv'
require 'argon2'
require 'toml-rb'
require 'mongo'

path = ARGV[0]
docs = Array.new

CSV.foreach(path) { |info|
    name = info[0]
    group = info[1]
    case info[2]
    when "true"
        admin = true
    when "false"
        admin = false
    else
        puts "invalid boolean value: #{info[2]}"
        exit
    end
    password = Argon2::Password.create(info[3])
    docs << {
        name: name,
        group: group,
        admin: admin,
        password: password
    }
}

config = TomlRB.load_file("dist/config.toml")
dsn = format(
    config['database']['format'],
    config['database']['user'],
    config['database']['pass'],
    config['database']['host'],
    config['database']['port']
)

client = Mongo::Client.new(dsn, :database => "zdotoj")
users = client[:users]
puts "Connected to #{config['database']['host']}:#{config['database']['port']}."

res = users.insert_many(docs)
puts "Inserted user ids:"
puts res.inserted_ids

client.close