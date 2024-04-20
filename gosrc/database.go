package main

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ID = primitive.ObjectID

var ErrInvalidObjectID = errors.New("invalid object id")

func convertObjectID(id any) ID {
	if parsed_id, ok := id.(ID); ok {
		return parsed_id
	}
	if hex_id, ok := id.(string); ok {
		parsed_id, err := primitive.ObjectIDFromHex(hex_id)
		if err != nil {
			panic(err)
		}
		return parsed_id
	}
	panic(ErrInvalidObjectID)
}

// Opaque database implementation.
type Database struct {
	cli *mongo.Client
	db *mongo.Database
}

// Creates and connects to the database using default configuration.
func NewDatabase() (*Database, error) {
	config := GetConfig()
	connectionString := fmt.Sprintf(
		config.Database.Format,
		url.QueryEscape(config.Database.User),
		url.QueryEscape(config.Database.Pass),
		config.Database.Host,
		config.Database.Port,
	)
	ctx, cancel := context.WithTimeout(context.Background(), 20 * time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(connectionString))
	if err != nil {
		return nil, err
	}
	d := &Database {
		cli: client,
		db: client.Database("zdotoj"),
	}
	return d, nil
}

// Queries stored user by its name.
func (d *Database) FindUserByName(name string) *User {
	user := new(User)
	if err := d.db.Collection("users").FindOne(context.Background(), bson.M{ "name": name }).Decode(user); err != nil {
		panic(err)
	}
	return user
}

// Queries stored user by its id.
func (d *Database) FindUserById(id any) *User {
	id = convertObjectID(id)
	user := new(User)
	if err := d.db.Collection("users").FindOne(context.Background(), bson.M{ "_id": id }).Decode(user); err != nil {
		panic(err)
	}
	return user
}

// Update password of a user with given id.
func (d *Database) UpdatePassword(id any, password string) {
	id = convertObjectID(id)
	_, err := d.db.Collection("users").UpdateByID(
		context.Background(), id,
		bson.M{
			"$set": bson.M{
				"password": password,
			},
		},
	)
	if err != nil {
		panic(err)
	}
} 

// Queries stored unit by its id. The result contains the amount of objectives rather than concrete objectives.
func (d *Database) FindUnitInfoById(id any) *UnitInfo {
	id = convertObjectID(id)
	unit := new(UnitInfo)
	if d.db.Collection("units").FindOne(
		context.Background(), bson.M{ "_id": id },
		options.FindOne().SetProjection(bson.M{
			"objectivecount": bson.M{
				"$size": "$objectives",
			},
			"difficulty": bson.M{
				"$avg": "$objectives.difficulty",
			},
			"name": 1, // had to be an inclusive projection due to mongodb's strange regulations
			"time": 1,
			"groups": 1,
			"tags": 1,
			"deadline": 1,
		}),
	).Decode(unit) != nil {
		return nil
	}
	return unit
}

// List stored units. The result contains the amount of objectives rather than concrete objectives.
func (d *Database) GetUnitInfos() []UnitInfo {
	cur, err := d.db.Collection("units").Find(context.Background(), bson.M{}, options.Find().SetProjection(bson.M{
		"objectivecount": bson.M{
			"$size": "$objectives",
		},
		"difficulty": bson.M{
			"$avg": "$objectives.difficulty",
		},
		"name": 1,
		"time": 1,
		"groups": 1,
		"tags": 1,
		"deadline": 1,
	}))
	if err != nil {
		fmt.Println(err)
		return nil
	}
	var results []UnitInfo
	cur.All(context.Background(), &results)
	return results
}

// Queries stored unit by its id. The result contains partial objectives without data points or scripts exposed.
func (d *Database) FindPartialUnitById(id any) *partialUnit {
	id = convertObjectID(id)
	unit := new(partialUnit)
	if d.db.Collection("units").FindOne(
		context.Background(), bson.M{ "_id": id },
		options.FindOne().SetProjection(bson.M{
			"objectives.points": 0,
			"objectives.rscript": 0,
			"objectives.sscript": 0,
		}),
	).Decode(unit) != nil {
		return nil
	}
	return unit
}

// Queries stored unit by its id. The result contains entire objectives.
func (d *Database) FindEntireUnitById(id any) *entireUnit {
	id = convertObjectID(id)
	unit := new(entireUnit)
	if d.db.Collection("units").FindOne(
		context.Background(), bson.M{ "_id": id },
	).Decode(unit) != nil {
		return nil
	}
	return unit
}

// Queries stored unit by its id. The result contains only one objective.
func (d *Database) FindUnitWithSingleObjective(id any, index int) *entireUnit {
	id = convertObjectID(id)
	unit := new(entireUnit)
	if d.db.Collection("units").FindOne(
		context.Background(), bson.M{ "_id": id },
		options.FindOne().SetProjection(bson.M{
			"objectives": bson.M {
				"$slice": bson.A { index, 1 },
			},
		}),
	).Decode(unit) != nil {
		return nil
	}
	return unit
}

// Stores an unit. Returns the inserted id.
func (d *Database) PutUnit(unit entireUnit) ID {
	unit_map := toBsonMap(unit, true)
	res, err := d.db.Collection("units").InsertOne(
		context.Background(), unit_map,
	)
	if err != nil {
		panic(err)
	}
	return convertObjectID(res.InsertedID)
}

func (d *Database) UpdateUnit(id any, unit entireUnit) {
	id = convertObjectID(id)
	_, err := d.db.Collection("units").ReplaceOne(
		context.Background(), bson.M { "_id": id }, unit,
	)
	if err != nil {
		panic(err)
	}
}

// Updates a single entry within a record, creating one if necessary.
func (d *Database) UpdateRecord(userId any, unitId any, index int, entry RecordEntry) (ID, bool) {
	col := d.db.Collection("records")
	cnt, err := col.CountDocuments(context.Background(), bson.M {
		"user": convertObjectID(userId),
		"unit": convertObjectID(unitId),
	})
	if err != nil {
		panic(err)
	}
	if (cnt <= 0) {
		unit := d.FindUnitInfoById(unitId)
		if unit == nil {
			return primitive.NilObjectID, false
		}
		entries := make([]RecordEntry, unit.ObjectiveCount)
		entries[index] = entry
		record := Record{
			User: convertObjectID(userId),
			Unit: convertObjectID(unitId),
			Entries: entries,
		}
		res, err := col.InsertOne(context.Background(), toBsonMap(record, true))
		if err != nil {
			panic(err)
		}
		return convertObjectID(res.InsertedID), true
	} else {
		_, err := col.UpdateOne(context.Background(), bson.M{
			"user": convertObjectID(userId),
			"unit": convertObjectID(unitId),
			fmt.Sprintf("entries.%d.passed", index): bson.M{
				"$lte": entry.Passed, // update if passed >= current value
			},
		}, bson.M {
			"$set": bson.M{
				fmt.Sprintf("entries.%d.code", index): entry.Code,
				fmt.Sprintf("entries.%d.passed", index): entry.Passed,
				fmt.Sprintf("entries.%d.total", index): entry.Total,
			},
		})
		if err != nil {
			panic(err)
		}
		return primitive.NilObjectID, true
	}
}

// Queries a single record by its user and unit.
func (d *Database) FindRecord(userId any, unitId any) *Record {
	record := new(Record)
	if d.db.Collection("records").FindOne(
		context.Background(), bson.M{
			"user": convertObjectID(userId),
			"unit": convertObjectID(unitId),
		},
	).Decode(record) != nil {
		return nil
	}
	return record
}

// Returns a limited set of recent records of given user.
func (d *Database) RecentRecordsOf(userId any, limit int) []Record {
	var records []Record
	cur, err := d.db.Collection("records").Find(
		context.Background(), bson.M{
			"user": convertObjectID(userId),
		},
		options.Find().SetLimit(int64(limit)).SetProjection(bson.M{
			"entries.code": 0,
		}),
	)
	if err != nil {
		panic(err)
	}
	cur.All(context.Background(), &records)
	return records
}

// Queries a single entry of a record with given user and unit.
func (d *Database) GetRecordEntry(userId any, unitId any, index int) *RecordEntry {
	record := new(Record)
	if d.db.Collection("records").FindOne(
		context.Background(), bson.M {
			"user": convertObjectID(userId),
			"unit": convertObjectID(unitId),
		},
		options.FindOne().SetProjection(bson.M{
			"entries": bson.M {
				"$slice": bson.A { index, 1 },
			},
		}),
	).Decode(record) != nil {
		return nil
	}
	return &record.Entries[0]
}

// List user groups.
func (d *Database) ListGroups() map[string]int {
	curs, err := d.db.Collection("users").Aggregate(
		context.Background(), bson.A{ bson.M {
			"$group": bson.M {
				"_id": "$group",
				"count": bson.M {
					"$count": bson.M {},
				},
			},
		}},
	)
	if err != nil {
		return nil
	}
	groups := make([]struct{
		Id string `bson:"_id"`
		Count int
	}, 0)
	curs.All(context.Background(), &groups)
	group_map := make(map[string]int)
	for _, g := range groups {
		group_map[g.Id] = g.Count
	}
	return group_map
}

// Returns database statistics.
func (d *Database) Stats() Stats {
	s := Stats{}
	if user_cnt, err := d.db.Collection("users").CountDocuments(context.Background(), bson.M{}); err != nil {
		panic(err);
	} else {
		s.Users = int(user_cnt)
	}

	if unit_cnt, err := d.db.Collection("units").CountDocuments(context.Background(), bson.M{}); err != nil {
		panic(err);
	} else {
		s.Units = int(unit_cnt)
	}
	
	if record_cnt, err := d.db.Collection("records").CountDocuments(context.Background(), bson.M{}); err != nil {
		panic(err);
	} else {
		s.Records = int(record_cnt)
	}
	
	return s
}