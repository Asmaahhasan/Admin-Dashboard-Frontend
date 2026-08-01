const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return 'https://api.wsyelhi.com/api';
};

const BASE_URL = getBaseUrl();

export function getToken() {
  return localStorage.getItem('admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token);
}

export function removeToken() {
  localStorage.removeItem('admin_token');
}

async function request(path: string, options: RequestInit = {}) {
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

export async function exportPdf(html: string, title: string) {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/syllabus-weeks/export-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ html, title }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إنشاء PDF عبر الخادم');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'syllabus-distribution'}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const api = {
  login: async (email: string, password: string) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
  },

  getStages: async () => request('/stages'),
  getGrades: async (trackId?: string, stageId?: string) => request(`/grades${trackId ? `?trackId=${trackId}` : stageId ? `?stageId=${stageId}` : ''}`),
  createGrade: async (stageId?: string, trackId?: string, name?: string, order?: number) => request('/grades', { method: 'POST', body: JSON.stringify({ stageId, trackId, name, order }) }),
  updateGrade: async (id: string, name: string, order: number) => request(`/grades/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) }),
  deleteGrade: async (id: string) => request(`/grades/${id}`, { method: 'DELETE' }),
  getSemesters: async (gradeId?: string) => request(`/semesters${gradeId ? `?gradeId=${gradeId}` : ''}`),
  createSemester: async (gradeId: string, name: string, order: number) => request('/semesters', { method: 'POST', body: JSON.stringify({ gradeId, name, order }) }),
  updateSemester: async (id: string, name: string) => request(`/semesters/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteSemester: async (id: string) => request(`/semesters/${id}`, { method: 'DELETE' }),
  getSubjects: async (gradeId?: string, semesterId?: string) => {
    try {
      return await request(`/subjects?gradeId=${gradeId || ''}&semesterId=${semesterId || ''}`);
    } catch {
      return await request(`/grade-subjects?gradeId=${gradeId || ''}&semesterId=${semesterId || ''}`);
    }
  },
  assignSubjectToGrade: async (gradeId: string, semesterId: string, name: string) => request('/grade-subjects', { method: 'POST', body: JSON.stringify({ gradeId, semesterId, name }) }),
  updateSubject: async (id: string, name: string) => request(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  updateGradeSubject: async (id: string, name: string) => request(`/grade-subjects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  removeSubjectFromGrade: async (id: string) => request(`/grade-subjects/${id}`, { method: 'DELETE' }),
  getSubjectLessons: async (gradeSubjectId: string) => request(`/subject-lessons?gradeSubjectId=${gradeSubjectId}`),
  createSubjectLesson: async (gradeSubjectId: string, lessonTitle: string) => request('/subject-lessons', { method: 'POST', body: JSON.stringify({ gradeSubjectId, lessonTitle }) }),
  updateSubjectLesson: async (id: string, lessonTitle: string) => request(`/subject-lessons/${id}`, { method: 'PUT', body: JSON.stringify({ lessonTitle }) }),
  deleteSubjectLesson: async (id: string) => request(`/subject-lessons/${id}`, { method: 'DELETE' }),
  getSyllabusWeeks: async (gradeSubjectId: string, region?: string) => request(`/syllabus-weeks?gradeSubjectId=${gradeSubjectId}&region=${region || 'GENERAL'}`),
  createSyllabusWeek: async (gradeSubjectIdOrPayload: any, weekNumber?: number, title?: string, options?: any) => {
    if (typeof gradeSubjectIdOrPayload === 'object') {
      return request('/syllabus-weeks', { method: 'POST', body: JSON.stringify(gradeSubjectIdOrPayload) });
    }
    return request('/syllabus-weeks', {
      method: 'POST',
      body: JSON.stringify({
        gradeSubjectId: gradeSubjectIdOrPayload,
        weekNumber,
        title,
        ...(options || {}),
      }),
    });
  },
  updateSyllabusWeek: async (id: string, payload: any) => request(`/syllabus-weeks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSyllabusWeek: async (id: string) => request(`/syllabus-weeks/${id}`, { method: 'DELETE' }),
  getCalendarDays: async (start: string, end: string, region?: string) => request(`/calendar-days?startDate=${start}&endDate=${end}&start=${start}&end=${end}&region=${region || 'GENERAL'}`),
  getActivities: async (gradeSubjectId: string) => request(`/activities?gradeSubjectId=${gradeSubjectId}`),
  createActivity: async (payload: any) => request('/activities', { method: 'POST', body: JSON.stringify(payload) }),
  updateActivity: async (id: string, payload: any) => request(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteActivity: async (id: string) => request(`/activities/${id}`, { method: 'DELETE' }),
  saveActivity: async (payload: any) => payload.id ? request(`/activities/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : request('/activities', { method: 'POST', body: JSON.stringify(payload) }),
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', { method: 'POST', body: formData });
  },
  createStage: async (name: string, order: number) => request('/stages', { method: 'POST', body: JSON.stringify({ name, order }) }),
  updateStage: async (id: string, name: string, order: number) => request(`/stages/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) }),
  deleteStage: async (id: string) => request(`/stages/${id}`, { method: 'DELETE' }),
  createTrack: async (stageId: string, name: string, order: number) => request('/tracks', { method: 'POST', body: JSON.stringify({ stageId, name, order }) }),
  updateTrack: async (id: string, name: string, order: number) => request(`/tracks/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) }),
  deleteTrack: async (id: string) => request(`/tracks/${id}`, { method: 'DELETE' }),
  exportPdf,
};
