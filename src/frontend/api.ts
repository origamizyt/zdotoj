import { sanitize } from 'dompurify';
import { marked } from 'marked';

export interface UnitInfo {
    id: string
    name: string
    time: Date
    deadline: Date
    groups: string[] | null
    tags: string[]
    difficulty: number
    objectiveCount: number
}

export interface Region {
    content: string
    editable: boolean
    indent: number
}

export enum Mode {
    Strict = 1, Special = 2, Random = 4
}

export interface ObjectiveInfo {
    name: string
    description: string
    difficulty: number
    template: Region[]
    mode: number
    language: number
    pointCount: number
}

export interface DataPoint {
    in: string
    out: string
    timeLimit: number
    memoryLimit: number
}

export interface Objective extends Omit<ObjectiveInfo, "pointCount"> {
    points: DataPoint[] | null
    rScript: string
    sScript: string
}

export interface Unit<T> {
    id: string
    name: string
    time: Date
    deadline: Date
    groups: string[] | null
    tags: string[]
    objectives: T[]
}

export type PureUnit<T> = Omit<Unit<T>, "id">;

export type Credential = {
    name: string
    password: string
}

export type Captcha = {
    captcha: string
    captchaId: string
}

export type Passwords = {
    oldPassword: string
    newPassword: string
}

export enum Status {
    IE = -3,
    CE,
    WA,
    OK,
    RE,
    TLE,
    MLE,
    SE
}

export type Result = {
    code: Status.IE,
    data: string
} |
{
    code: Status.CE,
    data: CompileResult
} |
{
    code: Status.WA,
    data: WAResult
} |
{
    code: Status.OK | Status.RE | Status.TLE | Status.MLE | Status.SE,
    data: ExecResult
}

export interface WatchMessage {
    taskId: number
    position: number
    results?: Result[]
}

export interface Stat {
    users: number
    units: number
    records: number
}

export interface Reason {
    code: number
    category: string
    id: string
    message: string
}

export function formatReason(reason: Reason): string{
    return `[${reason.category}:${reason.id}] ${reason.message}`
}

export type LanguageSpec = { id: string, name: string };

export const languages: LanguageSpec[] = [
    {
        id: 'c',
        name: 'C'
    },
    {
        id: 'cpp',
        name: 'C++'
    }
];

export function formatLanguage(lang: number): string {
    return languages[lang].name;
}

export function getLanguageId(lang: number): string {
    return languages[lang].id;
}

export function formatMode(mode: number): string {
    const modes = [];
    if ((mode & Mode.Strict) === Mode.Strict) {
        modes.push('Strict');
    }
    if ((mode & Mode.Special) === Mode.Special) {
        modes.push('SpecialJudge');
    }
    if ((mode & Mode.Random) === Mode.Random) {
        modes.push('RandomJudge');
    }
    return modes.join(', ') || 'Lax';
}

export interface RecordEntry {
    passed: number
    total: number
    code: string[] | null
}

export interface Record$ {
    id: string
    user: string
    unit: string
    entries: RecordEntry[]
}

export function average(record: Record$): number {
    const sum = record.entries.map(e => e.total > 0 ? e.passed / e.total : 0).reduce((a, b) => a+b);
    return sum / record.entries.length;
}

export interface Backend {
    fetchStat(): Promise<Stat>
    fetchUnits(): Promise<UnitInfo[]>
    fetchUnit(id: string): Promise<Unit<ObjectiveInfo>>
    fetchFullUnit(id: string): Promise<Unit<Objective>>
    fetchRecord(id: string): Promise<Record$>
    fetchRecordEntry(id: string, index: number): Promise<RecordEntry>
    fetchRecentRecords(limit: number): Promise<Record$[]>
    fetchGroups(): Promise<Record<string, number>>
    createUnit(unit: PureUnit<Objective>): Promise<string>
    updateUnit(id: string, unit: PureUnit<Objective>): Promise<void>
    getCaptcha(): Promise<[string, string]>;
    login(credential: Credential, captcha: Captcha): Promise<void>
    password(passwords: Passwords, captcha: Captcha): Promise<void>
    watchedRun(id: string, index: number, code: string[]): AsyncIterable<WatchMessage>
}

function getApiBase(): string {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:7113/_api'
    }
    return '/_api'
}

export class PrerunError extends Error {
    public readonly reason: Reason
    constructor(reason: Reason) {
        super(`Error prior to running: ${reason.message}`)
        this.reason = reason;
    }
}

export interface CompileResult {
    ok: boolean
    compiler: string
    exitCode: number
    error: string
}

export interface ExecResult {
    code: number
    execTime: number
    execMemory: number
    syscall: number
    termsig: number
}

export interface WAResult extends ExecResult {
    got: string
    expected: string
}

export const backend: Backend = {
    async fetchStat() {
        const resp = await fetch(getApiBase() + '/stat', {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw new Error("Failed to fetch stat.");
        return data.data;
    },
    async fetchUnits() {
        const resp = await fetch(getApiBase() + '/units', {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data.map((u: any) => ({
            ...u,
            time: new Date(u.time),
            deadline: new Date(u.deadline),
        }));
    },
    async fetchUnit(id) {
        const resp = await fetch(getApiBase() + '/units/' + id, {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        data.data.time = new Date(data.data.time);
        data.data.deadline = new Date(data.data.deadline);
        return data.data;
    },
    async fetchFullUnit(id) {
        const resp = await fetch(getApiBase() + '/units/' + id + '?full=true', {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        data.data.time = new Date(data.data.time);
        data.data.deadline = new Date(data.data.deadline);
        return data.data;
    },
    async fetchRecord(id) {
        const resp = await fetch(getApiBase() + '/records/' + id, {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data;
    },
    async fetchRecordEntry(id, index) {
        const resp = await fetch(getApiBase() + '/records/' + id + '?index=' + index, {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data;
    },
    async fetchRecentRecords(limit) {
        const resp = await fetch(getApiBase() + '/records?limit=' + limit, {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data;
    },
    async fetchGroups() {
        const resp = await fetch(getApiBase() + '/groups', {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data;
    },
    async login(credential, captcha) {
        const resp = await fetch(getApiBase() + '/account/human/login', {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify({
                ...credential,
                ...captcha
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        if (!data.ok) {
            throw data.reason;
        }
        if (process.env.NODE_ENV === 'development') {
            document.cookie = `zdotoj-token=${data.data}; max-age=1296000`;
        }
    },
    async password(passwords, captcha) {
        const resp = await fetch(getApiBase() + '/account/human/password', {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify({
                ...passwords,
                ...captcha
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        if (!data.ok) {
            throw data.reason;
        }
    },
    async *watchedRun(id, index, code) {
        const resp = await fetch(getApiBase() + '/run/watched/' + id, {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify({
                index,
                code
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (resp.status !== 200) throw new Error(`Failed to run objective: server returned status code ${resp.status}`);
        if (resp.headers.get('Content-Type') == 'application/json') {
            const data = await resp.json();
            throw new PrerunError(data.reason);
        }
        const decoder = new TextDecoderStream('utf-8');
        const reader = resp.body!.pipeThrough(decoder).getReader();
        let buffer = '';
        let lastPacket: any = null;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            while (buffer.includes('\n')) {
                const parts = buffer.split('\n');
                buffer = parts.slice(1).join('\n');
                const data = JSON.parse(parts[0]);
                if (data.pos >= 0) {
                    yield {
                        taskId: data.id,
                        position: data.pos
                    };
                }
                else if (lastPacket !== null) {
                    yield {
                        taskId: lastPacket.id,
                        position: lastPacket.pos,
                        results: data
                    };
                    lastPacket = null;
                }
                else {
                    lastPacket = data;
                }
            }
        }
    },
    async createUnit(unit): Promise<string> {
        const resp = await fetch(getApiBase() + '/units', {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify(unit),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return data.data;
    },
    async updateUnit(id, unit): Promise<void> {
        const resp = await fetch(getApiBase() + '/units/' + id, {
            credentials: 'include',
            method: 'PUT',
            body: JSON.stringify(unit),
            headers: {
                'Content-Type': 'application/json'
            },
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
    },
    async getCaptcha(): Promise<[string, string]> {
        const resp = await fetch(getApiBase() + '/account/captcha', {
            credentials: 'include'
        });
        const data = await resp.json();
        if (!data.ok) throw data.reason;
        return [
            data.data,
            `${getApiBase()}/account/captcha/${data.data}`
        ]
    }
}

export interface UserInfo {
    id: string
    name: string
    group: string
    admin: boolean
}

export interface Payload {
    address: string
    expires: Date
    subject: UserInfo
}

export function readToken(): Payload | undefined {
    if (document.cookie.trim() === "") return;
    const cookies: Record<string, string> = {};
    document.cookie
        .split(';')
        .map(segment => segment.split('='))
        .forEach(([key, value]) => {
            cookies[key.trim()] = value.trim();
        });
    if (typeof cookies['zdotoj-token'] === 'undefined') {
        return;
    }
    var data = JSON.parse(atob(cookies['zdotoj-token'].split('.')[1]));
    data.expires = new Date(data.expires);
    return data;
}

export function initialCode(template: Region[]): string[] {
    return template.filter(r => r.editable).map(r => r.content);
}

export function render(md: string): string {
    return sanitize(marked(md) as string);
}

export function parseQuery(query: string): Record<string, string> {
    if (query.startsWith('?')) query = query.slice(1);
    const rec: Record<string, string> = {};
    query
        .split('&')
        .map(part => part.split('='))
        .forEach(([key, value]) => {
            if (value === undefined) return;
            rec[key.trim()] = value.trim();
        })
    return rec;
}