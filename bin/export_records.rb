#! /usr/bin/ruby

require 'csv'
require 'mongo'
require 'toml-rb'

config = TomlRB.load_file("dist/config.toml")
dsn = format(
    config['database']['format'],
    config['database']['user'],
    config['database']['pass'],
    config['database']['host'],
    config['database']['port']
)

client = Mongo::Client.new(dsn, :database => "zdotoj")
records = client[:records]
puts "Connected to #{config['database']['host']}:#{config['database']['port']}."

puts "Interested unit id:"
unit_id = BSON::ObjectId.from_string(gets.chomp)
unit = client[:units].find(:_id => unit_id).first

if unit == nil
    puts "Unit does not exist."
    exit
end

puts "Writing CSV file in format:"
puts "USER, PASSED[1] / TOTAL[1] * DIFFICULTY[1], ..."
puts "Path of CSV file to write to:"
path = gets.chomp

CSV.open(path, "wb") { |f| 
    client[:records].find(:unit => unit_id).projection("entries.code" => 0).each { |doc|
        name = client[:users].find(:_id => doc["user"]).first["name"]
        arr = [name]
        doc["entries"].each_with_index { |entry, index| 
            arr << "#{entry['passed']/entry['total']*unit['objectives'][index]['difficulty']}"
        }
        f << arr
    }
}

puts "CSV exported to #{path}."
client.close