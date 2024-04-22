#! /usr/bin/ruby

require 'io/console'
require 'toml-rb'
require 'mongo'
require 'argon2'

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
puts "#{users.find.count_documents} users in total."
puts
puts "Commands: n (new), r (remove), q (query), x (exit)"
while true
    print "> "
    line = gets.chomp
    case line
    when "n"
        print "User name: "
        name = gets.chomp
        print "Password (will be hashed via argon2id): "
        password = STDIN.noecho(&:gets).chomp
        password = Argon2::Password.create(password)
        puts
        print "User group: "
        group = gets.chomp
        print "Administrator: [y/*] "
        admin = gets.chomp == "y"
        doc = {
            name: name,
            group: group,
            admin: admin,
            password: password
        }
        r = users.insert_one(doc)
        puts "Inserted user id: #{r.inserted_id}"
    when "r"
        print "User name: "
        name = gets.chomp
        doc = users.find({ name: name }).first
        if doc != nil
            puts "Id: #{doc['_id']}"
            puts "Group: #{doc['group']}"
            puts "Admin: #{doc['admin']}"
            print "Delete this user (and relevant records)? [y/*] "
            if gets.chomp == "y"
                users.delete_one({ _id: doc['_id'] })
                res = client[:records].delete_many({ 'user': doc['_id']})
                puts "1 user and #{res.deleted_count} records deleted."
            end
        else
            puts "User not found."
        end
    when "q"
        print "User name: "
        name = gets.chomp
        doc = users.find({ name: name }).first
        if doc != nil
            puts "Id: #{doc['_id']}"
            puts "Group: #{doc['group']}"
            puts "Admin: #{doc['admin']}"
        else
            puts "User not found."
        end
    when "x"
        break
    when ""
        next
    else
        puts "Invalid command."
    end
end

client.close