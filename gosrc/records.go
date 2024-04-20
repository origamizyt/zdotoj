package main

// Record per user per unit.
type Record struct {
	// Id of this record.
	Id		ID				`json:"id" bson:"_id"`
	// User id.
	User	ID				`json:"user"`
	// Unit id.
	Unit	ID				`json:"unit"`
	// Entries matching objectives.
	Entries	[]RecordEntry	`json:"entries"`
}

// Record per user per objective.
type RecordEntry struct {
	// User code.
	Code	[]string	`json:"code"`
	// Amount of data points passed.
	Passed	int			`json:"passed"`
	// Amount of data points in total.
	Total	int			`json:"total"`
}