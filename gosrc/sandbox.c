#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <sys/ptrace.h>
#include <sys/resource.h>
#include <sys/types.h>
#include <sys/user.h>
#include <sys/wait.h>
#include <syscall.h>
#include <unistd.h>

#include <stdio.h>

#define RC_OK 0
#define RC_RE 1
#define RC_TLE 2
#define RC_MLE 3
#define RC_SE 4
#define SIZEOFCFG sizeof(exec_cfg)

typedef struct _timeout_indicator {
    int thread_id;
    pid_t process_id;
    char flag;
    struct _timeout_indicator *next;
} timeout_indicator, *timeout_list;

typedef struct exec_cfg {
    int stdin_fd;
    int stdout_fd;
    int time_limit;
    int memory_limit;
    int *disallowed_syscall;
    int disallowed_syscall_count;
} exec_cfg;

typedef struct exec_res {
    int code;
    float exec_time;
    int exec_mem;
    int syscall;
    int termsig;
} exec_res;

timeout_list t_list = NULL;

pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;

void start_execute(int thread_id, pid_t process_id) {
    pthread_mutex_lock(&mutex);
    timeout_indicator *ti = malloc(sizeof(timeout_indicator));
    ti->thread_id = thread_id;
    ti->process_id = process_id;
    ti->flag = 0;
    ti->next = NULL;
    if (t_list == NULL) {
        t_list = ti;
    }
    else {
        timeout_indicator *cur;
        for (cur = t_list; cur->next; cur = cur->next);
        cur->next = ti;
    }
    pthread_mutex_unlock(&mutex);
}

pid_t set_timeout_for(int thread_id) {
    pthread_mutex_lock(&mutex);
    for (timeout_indicator *cur = t_list; cur; cur = cur->next) {
        if (cur->thread_id == thread_id) {
            cur->flag = 1;
            pthread_mutex_unlock(&mutex);
            return cur->process_id;
        }
    }
    pthread_mutex_unlock(&mutex);
    return 0;
}

void clear_timeout_for(int thread_id) {
    pthread_mutex_lock(&mutex);
    timeout_indicator *cur;
    for (cur = t_list; cur; cur = cur->next) {
        if (cur->thread_id == thread_id) break;
    }
    if (cur == NULL) {
        pthread_mutex_unlock(&mutex);
        return;
    }
    if (cur == t_list) {
        t_list = cur->next;
        free(cur);
    }
    else {
        timeout_indicator *prev;
        for (prev = t_list; prev->next != cur; prev = prev->next);
        prev->next = cur->next;
        free(cur);
    }
    pthread_mutex_unlock(&mutex);
}

char check_timeout_for(int thread_id) {
    pthread_mutex_lock(&mutex);
    for (timeout_indicator *cur = t_list; cur; cur = cur->next) {
        if (cur->thread_id == thread_id && cur->flag) {
            pthread_mutex_unlock(&mutex);
            return 1;
        }
    }
    pthread_mutex_unlock(&mutex);
    return 0;
}

int gettid() {
    return syscall(SYS_gettid);
}

void timeout_callback(int sig) {
    pid_t tid = gettid();
    pid_t pid = set_timeout_for(tid);
    if (pid) kill(pid, SIGKILL);
}

exec_res *execute(char *path, exec_cfg *cfg) {
    pid_t child = fork();
    if (child) {
        int status, memory_used = 0;
        struct user_regs_struct regs;
        struct rusage ru;
        exec_res *res = malloc(sizeof(exec_res));
        wait(&status);
        
        if (cfg->time_limit > 0) {
            alarm(cfg->time_limit);
            signal(SIGALRM, &timeout_callback);
        }

        start_execute(gettid(), child);

        for(;;) {
            ptrace(PTRACE_SYSCALL, child, NULL, NULL);
            wait4(child, &status, WUNTRACED, &ru);

            memory_used = ru.ru_maxrss * 1000;

            if (WIFEXITED(status)) {
                res->code = RC_OK;
                res->exec_time = (double)ru.ru_utime.tv_usec / 1000000;
                res->exec_mem = memory_used;
                break;
            }

            if (check_timeout_for(gettid())) {
                ptrace(PTRACE_KILL, child, NULL, NULL);
                res->code = RC_TLE;
                break;
            }

            if (WIFSIGNALED(status)) {
                ptrace(PTRACE_KILL, child, NULL, NULL);
                if (WTERMSIG(status) == SIGXCPU) {
                    res->code = RC_TLE;
                }
                else if (WTERMSIG(status) == SIGSEGV && cfg->memory_limit > 0 && memory_used > cfg->memory_limit)
                {
                    res->code = RC_MLE;
                }
                else {
                    res->code = RC_RE;
                    res->termsig = WTERMSIG(status);
                }
                break;
            }

            if (WIFSTOPPED(status) && WSTOPSIG(status) != SIGTRAP && WSTOPSIG(status) != SIGCHLD) {
                ptrace(PTRACE_KILL, child, NULL, NULL);
                if (WSTOPSIG(status) == SIGXCPU) {
                    res->code = RC_TLE;
                }
                else if (WSTOPSIG(status) == SIGSEGV && cfg->memory_limit > 0 && memory_used > cfg->memory_limit) {
                    res->code = RC_MLE;
                }
                else {
                    res->code = RC_RE;
                    res->termsig = WSTOPSIG(status);
                }
                break;
            }

            ptrace(PTRACE_GETREGS, child, NULL, &regs);

            char valid = 1;
            for (int i = 0; i < cfg->disallowed_syscall_count; i++) {
                if (cfg->disallowed_syscall[i] == regs.orig_rax) {
                    valid = 0;
                    break;
                }
            }
            if (!valid) {
                ptrace(PTRACE_KILL, child, NULL, NULL);
                waitpid(child, &status, WUNTRACED);
                res->code = RC_SE;
                res->syscall = regs.orig_rax;
                break;
            }
        }
        clear_timeout_for(gettid());
        return res;
    }
    else {
        dup2(cfg->stdin_fd, STDIN_FILENO);
        dup2(cfg->stdout_fd, STDOUT_FILENO);
        if (cfg->memory_limit > 0) {
            struct rlimit memory_limit;
            memory_limit.rlim_cur = memory_limit.rlim_max = cfg->memory_limit;
            setrlimit(RLIMIT_DATA, &memory_limit);
            memory_limit.rlim_cur = memory_limit.rlim_max = cfg->memory_limit*2;
            setrlimit(RLIMIT_AS, &memory_limit);
        }
        if (cfg->time_limit > 0) {
            struct rlimit time_limit;
            time_limit.rlim_cur = time_limit.rlim_max = cfg->time_limit;
            setrlimit(RLIMIT_CPU, &time_limit);
        }
        ptrace(PTRACE_TRACEME, 0, NULL, NULL);
        execl(path, path, NULL);
    }
    return NULL;
}