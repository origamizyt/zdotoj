package main

import (
	"sync"
	"sync/atomic"
)

// Watcher callback.
type Watcher func(*Task, int)

// Task for asynchronous execution of code.
type Task struct {
	Id			uint64
	Objective	Objective
	Code		string
	Watcher		Watcher
	Result		[]Result
}

var taskIdCounter = atomic.Uint64{}

// Creates a task with default values.
func NewTask(objective Objective, code string) *Task {
	return &Task {
		taskIdCounter.Add(1),
		objective,
		code,
		nil,
		nil,
	}
}

// Set watcher function.
func (t *Task) Watch(watcher Watcher) {
	t.Watcher = watcher
}

// Removes watcher function.
func (t *Task) RemoveWatcher() {
	t.Watcher = nil
}

func (t *Task) updatePos(pos int) {
	if t.Watcher != nil { t.Watcher(t, pos) }
}

// Runs this task synchronously.
func (t *Task) Run() {
	t.Result = t.Objective.Run(t.Code)
	t.updatePos(-1)
}

// Task queue, FIFO.
type Queue struct {
	queue 	[]*Task
	mutex	*sync.RWMutex
	waiter 	*sync.Cond
	// Whether this queue is running or not.
	Running bool
}

// Creates a new queue with locks.
func NewQueue() Queue {
	mut := &sync.RWMutex{}
	return Queue {
		queue: nil,
		mutex: mut,
		waiter: sync.NewCond(mut.RLocker()),
	}
}

// Finds a task by its id.
func (q *Queue) Find(id uint64) *Task {
	q.mutex.RLock()
	defer q.mutex.RUnlock()
	for _, t := range q.queue {
		if t.Id == id { return t }
	}
	return nil
}

// Blocks until a task is added. Returns immediately if not empty.
func (q *Queue) Peek() bool {
	q.mutex.RLock()
	defer q.mutex.RUnlock()
	for len(q.queue) <= 0 {
		q.waiter.Wait()
		if !q.Running { return false }
	}
	return true
}

// Adds a task to the front.
func (q *Queue) PushTop(t *Task) {
	q.mutex.Lock()
	old_queue := q.queue
	q.queue = make([]*Task, len(old_queue)+1)
	copy(q.queue[1:], old_queue)
	q.queue[0] = t
	for i, t := range q.queue {
		t.updatePos(i+1)
	}
	q.waiter.Signal()
	q.mutex.Unlock()
}

// Appends a task to the rear end.
func (q *Queue) Push(t *Task) int {
	q.mutex.Lock()
	q.queue = append(q.queue, t)
	pos := len(q.queue)
	t.updatePos(pos)
	q.waiter.Signal()
	q.mutex.Unlock()
	return pos
}

// Pops a task from the front.
// No need to peek before poping.
func (q *Queue) Pop() *Task {
	if !q.Peek() { return nil }
	q.mutex.Lock()
	v := q.queue[0]
	q.queue = q.queue[1:]
	v.updatePos(0)
	for i, t := range q.queue {
		t.updatePos(i+1)
	}
	q.mutex.Unlock()
	return v
}

// Stop all running instances.
func (q *Queue) Stop() {
	q.mutex.Lock() // allow writes to complete
	q.Running = false
	q.waiter.Signal()
	q.mutex.Unlock()
}

// Start a running instance of this queue, synchronously.
func (q *Queue) Launch() {
	q.Running = true
	for q.Running {
		t := q.Pop()
		if t == nil { break }
		t.Run()
	}
}