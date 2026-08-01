const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.wsyelhi.com/api';
export function getToken() {
    return localStorage.getItem('admin_token');
}
export function setToken(token) {
    localStorage.setItem('admin_token', token);
}
export function removeToken() {
    localStorage.removeItem('admin_token');
}
async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });
    if (res.status === 401 || res.status === 403) {
        removeToken();
        if (localStorage.getItem('admin_token')) {
            window.location.reload();
        }
    }
    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `حدث خطأ في الخادم (رقم: ${res.status})`);
    }
    return res.json();
}
export const api = {
    async login(email, password) {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        return data.user;
    },
    async getStages() {
        return request('/stages');
    },
    async getSemesters(gradeId) {
        const q = gradeId ? `?gradeId=${gradeId}` : '';
        return request(`/semesters${q}`);
    },
    async createSemester(gradeId, name, order) {
        return request('/semesters', { method: 'POST', body: JSON.stringify({ gradeId, name, order: order ?? 0 }) });
    },
    async updateSemester(id, name) {
        return request(`/semesters/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
    },
    async deleteSemester(id) {
        return request(`/semesters/${id}`, { method: 'DELETE' });
    },
    async createStage(name, order) {
        return request('/stages', { method: 'POST', body: JSON.stringify({ name, order }) });
    },
    async updateStage(id, name, order) {
        return request(`/stages/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
    },
    async deleteStage(id) {
        return request(`/stages/${id}`, { method: 'DELETE' });
    },
    async createTrack(stageId, name, order) {
        return request('/tracks', { method: 'POST', body: JSON.stringify({ stageId, name, order }) });
    },
    async updateTrack(id, name, order) {
        return request(`/tracks/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
    },
    async deleteTrack(id) {
        return request(`/tracks/${id}`, { method: 'DELETE' });
    },
    async createGrade(stageId, trackId, name, order) {
        return request('/grades', { method: 'POST', body: JSON.stringify({ stageId, trackId, name, order }) });
    },
    async updateGrade(id, name, order) {
        return request(`/grades/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
    },
    async deleteGrade(id) {
        return request(`/grades/${id}`, { method: 'DELETE' });
    },
    async getGrades(stageId, trackId) {
        const query = trackId ? `?trackId=${trackId}` : '';
        return request(`/grades/${stageId}${query}`);
    },
    async getSubjects(gradeId, semesterId) {
        return request(`/subjects?gradeId=${gradeId}&semesterId=${semesterId}`);
    },
    async assignSubjectToGrade(gradeId, semesterId, name) {
        return request('/grade-subjects', { method: 'POST', body: JSON.stringify({ gradeId, semesterId, name }) });
    },
    async updateSubject(id, name) {
        return request(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
    },
    async updateGradeSubject(id, name) {
        return request(`/grade-subjects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
    },
    async removeSubjectFromGrade(id) {
        return request(`/grade-subjects/${id}`, { method: 'DELETE' });
    },
    async getSubjectLessons(gradeSubjectId) {
        return request(`/subject-lessons?gradeSubjectId=${gradeSubjectId}`);
    },
    async createSubjectLesson(gradeSubjectId, lessonTitle) {
        return request('/subject-lessons', { method: 'POST', body: JSON.stringify({ gradeSubjectId, lessonTitle }) });
    },
    async updateSubjectLesson(id, lessonTitle) {
        return request(`/subject-lessons/${id}`, { method: 'PUT', body: JSON.stringify({ lessonTitle }) });
    },
    async deleteSubjectLesson(id) {
        return request(`/subject-lessons/${id}`, { method: 'DELETE' });
    },
    async getSyllabusWeeks(gradeSubjectId, region) {
        const qRegion = region ? `&region=${region}` : '';
        return request(`/syllabus-weeks?gradeSubjectId=${gradeSubjectId}${qRegion}`);
    },
    async getCalendarDays(startDate, endDate, region) {
        return request(`/calendar-days?startDate=${startDate}&endDate=${endDate}&region=${region}`);
    },
    async saveCalendarDay(payload) {
        return request('/calendar-days', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    async createSyllabusWeek(gradeSubjectId, weekNumber, title, options) {
        return request('/syllabus-weeks', {
            method: 'POST',
            body: JSON.stringify({
                gradeSubjectId,
                weekNumber,
                title,
                startDateHijri: options?.startDateHijri || null,
                endDateHijri: options?.endDateHijri || null,
                weekType: options?.weekType || 'LESSON',
                region: options?.region || 'GENERAL',
                days: options?.days || null,
            }),
        });
    },
    async deleteSyllabusWeek(id) {
        return request(`/syllabus-weeks/${id}`, {
            method: 'DELETE',
        });
    },
    async saveActivity(payload) {
        return request('/activities', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    async getActivities(gradeSubjectId) {
        return request(`/activities?gradeSubjectId=${gradeSubjectId}`);
    },
    async deleteActivity(id) {
        return request(`/activities/${id}`, {
            method: 'DELETE',
        });
    },
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        return request('/upload', {
            method: 'POST',
            body: formData,
        });
    },
};
