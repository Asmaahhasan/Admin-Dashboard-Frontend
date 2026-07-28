const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.wsyelhi.com/api';

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

export const api = {
  async login(email: string, password: string) {
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

  async getSemesters(gradeId?: string) {
    const q = gradeId ? `?gradeId=${gradeId}` : '';
    return request(`/semesters${q}`);
  },

  async createSemester(gradeId: string, name: string, order?: number) {
    return request('/semesters', { method: 'POST', body: JSON.stringify({ gradeId, name, order: order ?? 0 }) });
  },

  async updateSemester(id: string, name: string) {
    return request(`/semesters/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  async deleteSemester(id: string) {
    return request(`/semesters/${id}`, { method: 'DELETE' });
  },

  async createStage(name: string, order: number) {
    return request('/stages', { method: 'POST', body: JSON.stringify({ name, order }) });
  },

  async updateStage(id: string, name: string, order: number) {
    return request(`/stages/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
  },

  async deleteStage(id: string) {
    return request(`/stages/${id}`, { method: 'DELETE' });
  },

  async createTrack(stageId: string, name: string, order: number) {
    return request('/tracks', { method: 'POST', body: JSON.stringify({ stageId, name, order }) });
  },

  async updateTrack(id: string, name: string, order: number) {
    return request(`/tracks/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
  },

  async deleteTrack(id: string) {
    return request(`/tracks/${id}`, { method: 'DELETE' });
  },

  async createGrade(stageId: string | undefined, trackId: string | undefined, name: string, order: number) {
    return request('/grades', { method: 'POST', body: JSON.stringify({ stageId, trackId, name, order }) });
  },

  async updateGrade(id: string, name: string, order: number) {
    return request(`/grades/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
  },

  async deleteGrade(id: string) {
    return request(`/grades/${id}`, { method: 'DELETE' });
  },

  async getGrades(stageId: string, trackId?: string) {
    const query = trackId ? `?trackId=${trackId}` : '';
    return request(`/grades/${stageId}${query}`);
  },

  async getSubjects(gradeId: string, semesterId: string) {
    return request(`/subjects?gradeId=${gradeId}&semesterId=${semesterId}`);
  },

  async assignSubjectToGrade(gradeId: string, semesterId: string, subjectName: string) {
    return request('/grade-subject/assign', {
      method: 'POST',
      body: JSON.stringify({ gradeId, semesterId, subjectName }),
    });
  },

  async removeSubjectFromGrade(gradeSubjectId: string) {
    return request(`/grade-subject/${gradeSubjectId}`, {
      method: 'DELETE',
    });
  },

  async getSyllabusWeeks(gradeSubjectId: string, region?: string) {
    const qRegion = region ? `&region=${region}` : '';
    return request(`/syllabus-weeks?gradeSubjectId=${gradeSubjectId}${qRegion}`);
  },

  async getCalendarDays(startDate: string, endDate: string, region: string) {
    return request(`/calendar-days?startDate=${startDate}&endDate=${endDate}&region=${region}`);
  },

  async saveCalendarDay(payload: { date: string; dayName: string; type: string; region: string; note?: string }) {
    return request('/calendar-days', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createSyllabusWeek(
    gradeSubjectId: string,
    weekNumber: number,
    title: string,
    options?: { startDateHijri?: string; endDateHijri?: string; weekType?: string; region?: string; days?: any }
  ) {
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

  async deleteSyllabusWeek(id: string) {
    return request(`/syllabus-weeks/${id}`, {
      method: 'DELETE',
    });
  },

  async saveActivity(payload: {
    id?: string;
    gradeSubjectId: string;
    syllabusWeekId?: string;
    lessonTitle: string;
    items: Array<{
      type: string;
      title: string;
      url?: string;
      filePath?: string;
      thumbnailUrl?: string;
    }>;
  }) {
    return request('/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getActivities(gradeSubjectId: string) {
    return request(`/activities?gradeSubjectId=${gradeSubjectId}`);
  },

  async deleteActivity(id: string) {
    return request(`/activities/${id}`, {
      method: 'DELETE',
    });
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', {
      method: 'POST',
      body: formData,
    });
  },
  async exportPdf(html: string, title: string) {
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
  },
};
