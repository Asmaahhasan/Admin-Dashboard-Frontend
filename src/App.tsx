import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { api, getToken, removeToken } from './api';
import {
  LogOut, Plus, Trash2, Upload, Link as LinkIcon,
  FileText, Gamepad2, Tv, Save, BookOpen,
  CheckCircle, X, AlertCircle, CalendarDays, Layers,
  Settings, Pencil, Sun, Moon, ChevronRight,
  GraduationCap, BookMarked, Library, Image, Printer, Download
} from 'lucide-react';
import './index.css';

// ── Types ──
interface Grade { id: string; name: string; order: number; trackId: string; }
interface Track { id: string; name: string; order: number; stageId: string; grades: Grade[]; }
interface Stage { id: string; name: string; order: number; tracks: Track[]; }
interface Semester { id: string; name: string; order: number; gradeId: string; }
interface SubjectOption { gradeSubjectId: string; subjectId: string; name: string; }
interface LessonActivityItem { id?: string; type: string; title: string; url?: string; filePath?: string; thumbnailUrl?: string; }
interface LessonActivity { id: string; gradeSubjectId: string; syllabusWeekId?: string | null; lessonTitle: string; items: LessonActivityItem[]; }
interface SyllabusWeek { id: string; gradeSubjectId: string; weekNumber: number; title: string; startDateHijri?: string | null; endDateHijri?: string | null; weekType?: string | null; activity?: LessonActivity | null; }

type Page = 'syllabus' | 'activities' | 'curriculum';
type Theme = 'dark' | 'light';

const NO_TRACK_STAGE_KEYWORDS = ['ابتدائية', 'متوسطة', 'خاصة', 'مستمر'];
const stageHasNoTracks = (stage: Stage): boolean => {
  if (!stage) return true;
  const name = stage.name;
  return NO_TRACK_STAGE_KEYWORDS.some(kw => name.includes(kw));
};

// ── Theme Hook ──
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('admin_theme') as Theme) || 'dark';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return [theme, toggle];
}

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
      <input autoFocus type="text" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel(); }}
        style={{ flex: 1, padding: '5px 10px', fontSize: 13, borderRadius: 8, border: '1.5px solid var(--primary)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'Cairo', outline: 'none' }}
      />
      <button className="btn-primary sm" onClick={() => onSave(val)}><Save size={13} /></button>
      <button className="btn-ghost sm" onClick={onCancel}><X size={13} /></button>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="overlay">
      <div className="modal glass" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} /> تحذير: تأكيد الحذف
          </h3>
          <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
        </div>
        <p style={{ padding: '16px 20px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8 }}>{message}</p>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onCancel}>إلغاء</button>
          <button className="btn-danger" onClick={onConfirm}><Trash2 size={14} /> تأكيد الحذف</button>
        </div>
      </div>
    </div>
  );
}

function AddRow({ placeholder, onSave, onCancel }: { placeholder: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', background: 'var(--primary-dim)', borderRadius: 10, border: '1.5px dashed var(--primary)' }}>
      <input autoFocus type="text" value={val} placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); if (e.key === 'Escape') onCancel(); }}
        style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'Cairo', outline: 'none' }}
      />
      <button className="btn-primary sm" onClick={() => val.trim() && onSave(val.trim())}><Plus size={13} /> إضافة</button>
      <button className="btn-ghost sm" onClick={onCancel}><X size={13} /></button>
    </div>
  );
}

// ── Curriculum Page ──
function CurriculumPage({ notify }: { notify: (t: 'success' | 'error', m: string) => void }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [selStageId, setSelStageId] = useState('');
  const [selTrackId, setSelTrackId] = useState('');
  const [selGradeId, setSelGradeId] = useState('');
  const [selSemId, setSelSemId] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [gradeSubjects, setGradeSubjects] = useState<SubjectOption[]>([]);
  const [addingStage, setAddingStage] = useState(false);
  const [addingTrack, setAddingTrack] = useState(false);
  const [addingGrade, setAddingGrade] = useState(false);
  const [addingSem, setAddingSem] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editType, setEditType] = useState('');
  const [confirmData, setConfirmData] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => { loadStages(); }, []);

  const loadStages = async () => {
    try { const s = await api.getStages(); setStages(s); }
    catch { notify('error', 'فشل تحميل البيانات.'); }
  };
  const loadSemesters = async (gId: string) => {
    try { const s = await api.getSemesters(gId); setSemesters(s); }
    catch { notify('error', 'فشل تحميل الفصول.'); }
  };
  const loadSubjects = async (gId: string, sId: string) => {
    try { const s = await api.getSubjects(gId, sId); setGradeSubjects(s); }
    catch { notify('error', 'فشل تحميل المواد.'); }
  };

  const selStage = stages.find(s => s.id === selStageId);
  const noTracks = selStage ? stageHasNoTracks(selStage) : true;
  const realTracks = selStage ? selStage.tracks.filter(t => t.name !== 'عام') : [];
  const selTrack = realTracks.find(t => t.id === selTrackId);
  const gradesToShow: Grade[] = selStage
    ? (noTracks ? selStage.tracks.flatMap(t => t.grades) : selTrackId ? (selTrack?.grades ?? []) : [])
    : [];
  const selGrade = gradesToShow.find(g => g.id === selGradeId);
  const selSem = semesters.find(s => s.id === selSemId);

  const confirmDelete = (message: string, action: () => Promise<void>) => {
    setConfirmData({
      message, onConfirm: async () => {
        setConfirmData(null);
        try { await action(); notify('success', 'تم الحذف.'); }
        catch (e: any) { notify('error', e.message); }
      }
    });
  };

  const handleAddStage = async (name: string) => {
    try { await api.createStage(name, stages.length + 1); setAddingStage(false); await loadStages(); notify('success', 'تمت الإضافة.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleEditStage = async (id: string, name: string) => {
    try { await api.updateStage(id, name, stages.find(s => s.id === id)?.order ?? 0); setEditingId(''); await loadStages(); notify('success', 'تم التعديل.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleDeleteStage = (stage: Stage) => confirmDelete(
    `سيتم حذف مرحلة "${stage.name}" مع جميع مساراتها وصفوفها وفصولها ومواد الدراسية وتوزيع المنهج بشكل كامل.`,
    async () => { await api.deleteStage(stage.id); if (selStageId === stage.id) { setSelStageId(''); setSelTrackId(''); setSelGradeId(''); setSelSemId(''); } await loadStages(); }
  );
  const handleAddTrack = async (name: string) => {
    if (!selStageId) return;
    try { await api.createTrack(selStageId, name, realTracks.length + 1); setAddingTrack(false); await loadStages(); notify('success', 'تمت الإضافة.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleEditTrack = async (id: string, name: string) => {
    try { await api.updateTrack(id, name, realTracks.find(t => t.id === id)?.order ?? 0); setEditingId(''); await loadStages(); notify('success', 'تم التعديل.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleDeleteTrack = (track: Track) => confirmDelete(
    `سيتم حذف مسار "${track.name}" مع جميع صفوفه وفصوله ومواده ومنهجه الدراسي.`,
    async () => { await api.deleteTrack(track.id); if (selTrackId === track.id) { setSelTrackId(''); setSelGradeId(''); setSelSemId(''); } await loadStages(); }
  );
  const handleAddGrade = async (name: string) => {
    if (!selStageId) return;
    const trackId = noTracks ? undefined : selTrackId || undefined;
    const stageId = noTracks ? selStageId : undefined;
    try { await api.createGrade(stageId, trackId, name, gradesToShow.length + 1); setAddingGrade(false); await loadStages(); notify('success', 'تمت الإضافة.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleEditGrade = async (id: string, name: string) => {
    try { await api.updateGrade(id, name, gradesToShow.find(g => g.id === id)?.order ?? 0); setEditingId(''); await loadStages(); notify('success', 'تم التعديل.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleDeleteGrade = (grade: Grade) => confirmDelete(
    `سيتم حذف الصف "${grade.name}" مع جميع فصوله الدراسية ومواده وتوزيع المنهج والأنشطة المرتبطة به.`,
    async () => { await api.deleteGrade(grade.id); if (selGradeId === grade.id) { setSelGradeId(''); setSelSemId(''); setSemesters([]); } await loadStages(); }
  );
  const handleAddSem = async (name: string) => {
    if (!selGradeId) return;
    try { await api.createSemester(selGradeId, name, semesters.length + 1); setAddingSem(false); await loadSemesters(selGradeId); notify('success', 'تمت الإضافة.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleEditSem = async (id: string, name: string) => {
    try { await api.updateSemester(id, name); setEditingId(''); await loadSemesters(selGradeId); notify('success', 'تم التعديل.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleDeleteSem = (sem: Semester) => {
    const hasSubjects = gradeSubjects.length > 0 && selSemId === sem.id;
    const msg = hasSubjects
      ? `يحتوي الفصل "${sem.name}" على مواد دراسية. سيتم حذفه مع جميع مواده وأسابيع المنهج والأنشطة.`
      : `سيتم حذف الفصل "${sem.name}" وكل محتوياته.`;
    confirmDelete(msg, async () => {
      await api.deleteSemester(sem.id);
      if (selSemId === sem.id) { setSelSemId(''); setGradeSubjects([]); }
      await loadSemesters(selGradeId);
    });
  };
  const handleAddSubject = async (name: string) => {
    if (!selGradeId || !selSemId) return;
    try { await api.assignSubjectToGrade(selGradeId, selSemId, name); setAddingSubject(false); await loadSubjects(selGradeId, selSemId); notify('success', 'تمت الإضافة.'); }
    catch (e: any) { notify('error', e.message); }
  };
  const handleDeleteSubject = (sub: SubjectOption) => confirmDelete(
    `سيتم حذف مادة "${sub.name}" من هذا الفصل مع جميع أسابيع المنهج والأنشطة المرتبطة.`,
    async () => { await api.removeSubjectFromGrade(sub.gradeSubjectId); await loadSubjects(selGradeId, selSemId); }
  );

  const pickStage = (s: Stage) => {
    if (selStageId === s.id) { setSelStageId(''); } else { setSelStageId(s.id); }
    setSelTrackId(''); setSelGradeId(''); setSelSemId(''); setSemesters([]); setGradeSubjects([]);
  };
  const pickTrack = (t: Track) => {
    if (selTrackId === t.id) { setSelTrackId(''); } else { setSelTrackId(t.id); }
    setSelGradeId(''); setSelSemId(''); setSemesters([]); setGradeSubjects([]);
  };
  const pickGrade = (g: Grade) => {
    if (selGradeId === g.id) { setSelGradeId(''); setSelSemId(''); setSemesters([]); setGradeSubjects([]); }
    else { setSelGradeId(g.id); setSelSemId(''); setGradeSubjects([]); loadSemesters(g.id); }
  };
  const pickSem = (s: Semester) => {
    if (selSemId === s.id) { setSelSemId(''); setGradeSubjects([]); }
    else { setSelSemId(s.id); loadSubjects(selGradeId, s.id); }
  };

  const totalGrades = stages.reduce((a, s) => a + s.tracks.reduce((b, t) => b + t.grades.length, 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><Settings size={22} /> إدارة الهيكل الدراسي</h2>
          <p>صفحة موحدة — اختر المرحلة ثم تتدرج الشجرة تلقائياً</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge">{stages.length} مرحلة</span>
          <span className="badge success">{totalGrades} صف</span>
        </div>
      </div>
      <div className="cur-tree-wrap glass">
        <div className="tree-level">
          <div className="tree-level-header">
            <span className="tree-level-label"><GraduationCap size={14} /> المراحل الدراسية</span>
            <button className="icon-btn" onClick={() => setAddingStage(v => !v)}><Plus size={14} /></button>
          </div>
          <div className="tree-items">
            {stages.map(s => (
              <div key={s.id} className="tree-stage-block">
                <div className={`tree-item ${selStageId === s.id ? 'selected' : ''}`}>
                  {editingId === s.id && editType === 'stage'
                    ? <InlineEdit value={s.name} onSave={v => handleEditStage(s.id, v)} onCancel={() => setEditingId('')} />
                    : <span className="tree-item-name" onClick={() => pickStage(s)}>{s.name}</span>
                  }
                  {editingId !== s.id && (
                    <div className="tree-item-actions">
                      <button className="icon-btn" onClick={() => { setEditingId(s.id); setEditType('stage'); }}><Pencil size={12} /></button>
                      <button className="icon-btn danger" onClick={() => handleDeleteStage(s)}><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {selStageId === s.id && (
                  <div className="tree-inline-expand">
                    {!noTracks && (
                      <div className="tree-inline-section">
                        <div className="tree-inline-label">
                          <ChevronRight size={13} /> المسارات
                          <button className="icon-btn" style={{ marginRight: 'auto' }} onClick={() => setAddingTrack(v => !v)}><Plus size={12} /></button>
                        </div>
                        <div className="tree-chips-row">
                          {realTracks.map(t => (
                            editingId === t.id && editType === 'track'
                              ? <div key={t.id} style={{ width: '100%' }}><InlineEdit value={t.name} onSave={v => handleEditTrack(t.id, v)} onCancel={() => setEditingId('')} /></div>
                              : (
                                <button key={t.id} className={`tree-chip ${selTrackId === t.id ? 'active' : ''}`} onClick={() => pickTrack(t)}>
                                  {t.name}
                                  <span className="tree-chip-count">{t.grades.length}</span>
                                  <span className="tree-chip-act" onClick={e => { e.stopPropagation(); setEditingId(t.id); setEditType('track'); }}><Pencil size={10} /></span>
                                  <span className="tree-chip-act danger" onClick={e => { e.stopPropagation(); handleDeleteTrack(t); }}><Trash2 size={10} /></span>
                                </button>
                              )
                          ))}
                          {realTracks.length === 0 && !addingTrack && <span className="tree-chip-empty">لا توجد مسارات</span>}
                        </div>
                        {addingTrack && <AddRow placeholder="اسم المسار" onSave={handleAddTrack} onCancel={() => setAddingTrack(false)} />}
                      </div>
                    )}
                    {(noTracks || selTrackId) && (
                      <div className="tree-inline-section">
                        <div className="tree-inline-label">
                          <BookMarked size={13} /> الصفوف{selTrack ? `: ${selTrack.name}` : ''}
                          <button className="icon-btn" style={{ marginRight: 'auto' }} onClick={() => setAddingGrade(v => !v)}><Plus size={12} /></button>
                        </div>
                        <div className="tree-chips-row">
                          {gradesToShow.map(g => (
                            editingId === g.id && editType === 'grade'
                              ? <div key={g.id} style={{ width: '100%' }}><InlineEdit value={g.name} onSave={v => handleEditGrade(g.id, v)} onCancel={() => setEditingId('')} /></div>
                              : (
                                <button key={g.id} className={`tree-chip ${selGradeId === g.id ? 'active' : ''}`} onClick={() => pickGrade(g)}>
                                  {g.name}
                                  <span className="tree-chip-act" onClick={e => { e.stopPropagation(); setEditingId(g.id); setEditType('grade'); }}><Pencil size={10} /></span>
                                  <span className="tree-chip-act danger" onClick={e => { e.stopPropagation(); handleDeleteGrade(g); }}><Trash2 size={10} /></span>
                                </button>
                              )
                          ))}
                          {gradesToShow.length === 0 && !addingGrade && <span className="tree-chip-empty">لا توجد صفوف</span>}
                        </div>
                        {addingGrade && <AddRow placeholder="مثال: الصف الأول الابتدائي" onSave={handleAddGrade} onCancel={() => setAddingGrade(false)} />}
                      </div>
                    )}
                    {selGrade && (
                      <div className="tree-inline-section">
                        <div className="tree-inline-label">
                          <CalendarDays size={13} /> فصول: {selGrade.name}
                          <button className="icon-btn" style={{ marginRight: 'auto' }} onClick={() => setAddingSem(v => !v)}><Plus size={12} /></button>
                        </div>
                        <div className="tree-chips-row">
                          {semesters.map(sem => (
                            editingId === sem.id && editType === 'sem'
                              ? <div key={sem.id} style={{ width: '100%' }}><InlineEdit value={sem.name} onSave={v => handleEditSem(sem.id, v)} onCancel={() => setEditingId('')} /></div>
                              : (
                                <button key={sem.id} className={`tree-chip ${selSemId === sem.id ? 'active' : ''}`} onClick={() => pickSem(sem)}>
                                  {sem.name}
                                  <span className="tree-chip-act" onClick={e => { e.stopPropagation(); setEditingId(sem.id); setEditType('sem'); }}><Pencil size={10} /></span>
                                  <span className="tree-chip-act danger" onClick={e => { e.stopPropagation(); handleDeleteSem(sem); }}><Trash2 size={10} /></span>
                                </button>
                              )
                          ))}
                          {semesters.length === 0 && !addingSem && <span className="tree-chip-empty">لا توجد فصول لهذا الصف</span>}
                        </div>
                        {addingSem && <AddRow placeholder="مثال: الفصل الدراسي الأول" onSave={handleAddSem} onCancel={() => setAddingSem(false)} />}
                      </div>
                    )}
                    {selSem && (
                      <div className="tree-inline-section">
                        <div className="tree-inline-label">
                          <Library size={13} /> مواد: {selSem.name}
                          <button className="icon-btn" style={{ marginRight: 'auto' }} onClick={() => setAddingSubject(v => !v)}><Plus size={12} /></button>
                        </div>
                        <div className="tree-chips-row">
                          {gradeSubjects.map(sub => (
                            <button key={sub.gradeSubjectId} className="tree-chip tree-chip-subject">
                              {sub.name}
                              <span className="tree-chip-act danger" onClick={e => { e.stopPropagation(); handleDeleteSubject(sub); }}><Trash2 size={10} /></span>
                            </button>
                          ))}
                          {gradeSubjects.length === 0 && !addingSubject && <span className="tree-chip-empty">لا توجد مواد — اضغط + للربط</span>}
                        </div>
                        {addingSubject && <AddRow placeholder="مثال: الرياضيات" onSave={handleAddSubject} onCancel={() => setAddingSubject(false)} />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {addingStage && <AddRow placeholder="اسم المرحلة" onSave={handleAddStage} onCancel={() => setAddingStage(false)} />}
            {stages.length === 0 && !addingStage && <div className="tree-empty">لا توجد مراحل — اضغط + للإضافة</div>}
          </div>
        </div>
      </div>
      {confirmData && (
        <ConfirmModal message={confirmData.message} onConfirm={confirmData.onConfirm} onCancel={() => setConfirmData(null)} />
      )}
    </div>
  );
}

// ── Filter Bar ──
interface FilterState {
  stages: Stage[]; semesters: Semester[]; tracks: Track[];
  grades: Grade[]; subjects: SubjectOption[];
  stageId: string; trackId: string; gradeId: string; semesterId: string; subjectId: string;
  gradeSubjectId: string;
  setStageId: (v: string) => void; setTrackId: (v: string) => void;
  setGradeId: (v: string) => void; setSemesterId: (v: string) => void;
  setSubjectId: (v: string) => void;
  reloadSubjects: () => void;
}

function FilterBar({ f, hideSubjects }: { f: FilterState, hideSubjects?: boolean }) {
  const selectedStage = f.stages.find(s => s.id === f.stageId);
  const selectedGrade = f.grades.find(g => g.id === f.gradeId);
  const selectedSemester = f.semesters.find(s => s.id === f.semesterId);
  const selectedSubject = f.subjects.find(s => s.subjectId === f.subjectId);
  const showTracks = f.tracks.length > 0;

  return (
    <div className="filter-bar-v3">
      <div className="filter-grid">
        <div className="filter-section">
          <div className="filter-section-label">
            <span className="step-num">1</span> اختر المرحلة الدراسية
          </div>
          <div className="chip-grid">
            {f.stages.map(s => (
              <button key={s.id} className={`chip ${f.stageId === s.id ? 'selected' : ''}`} onClick={() => f.setStageId(s.id)}>
                {s.name}
              </button>
            ))}
            {f.stages.length === 0 && <span className="filter-empty">لا توجد مراحل — أضفها أولاً</span>}
          </div>
        </div>

        {f.stageId && showTracks && (
          <div className="filter-section">
            <div className="filter-section-label">
              <span className="step-num">2</span> اختر المسار
            </div>
            <div className="chip-grid">
              {f.tracks.map(t => (
                <button key={t.id} className={`chip ${f.trackId === t.id ? 'selected' : ''}`} onClick={() => f.setTrackId(t.id)}>{t.name}</button>
              ))}
            </div>
          </div>
        )}

        {f.stageId && (!showTracks || f.trackId) && (
          <div className="filter-section">
            <div className="filter-section-label">
              <span className="step-num">{showTracks ? '3' : '2'}</span> اختر الصف
            </div>
            <div className="chip-grid">
              {f.grades.length === 0 && <span className="filter-empty">لا توجد صفوف</span>}
              {f.grades.map(g => (
                <button key={g.id} className={`chip ${f.gradeId === g.id ? 'selected' : ''}`} onClick={() => f.setGradeId(g.id)}>
                  {g.name.replace('الصف ', '').replace(' الابتدائي', '').replace(' المتوسط', '').replace(' الثانوي', '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {f.gradeId && (
          <div className="filter-section">
            <div className="filter-section-label">
              <span className="step-num">{showTracks ? '4' : '3'}</span> اختر الفصل الدراسي
            </div>
            <div className="chip-grid">
              {f.semesters.filter(s => s.gradeId === f.gradeId).map(s => (
                <button key={s.id} className={`chip ${f.semesterId === s.id ? 'selected' : ''}`} onClick={() => f.setSemesterId(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hideSubjects && f.gradeId && f.semesterId && (
          <div className="filter-section">
            <div className="filter-section-label">
              <span className="step-num">{showTracks ? '5' : '4'}</span> اختر المادة
            </div>
            <div className="chip-grid">
              {f.subjects.length === 0 && <span className="filter-empty">لا توجد مواد مرتبطة</span>}
              {f.subjects.map(s => (
                <button key={s.subjectId} className={`chip ${f.subjectId === s.subjectId ? 'selected' : ''}`} onClick={() => f.setSubjectId(s.subjectId)}>{s.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {f.gradeSubjectId && (
        <div className="filter-summary">
          {selectedStage && <span className="summary-badge badge-stage">{selectedStage.name} ✓</span>}
          {f.trackId && <span className="summary-badge badge-track">{f.tracks.find(t => t.id === f.trackId)?.name} ✓</span>}
          {selectedGrade && <span className="summary-badge badge-grade">{selectedGrade.name} ✓</span>}
          {selectedSemester && <span className="summary-badge badge-semester">{selectedSemester.name} ✓</span>}
          {selectedSubject && <span className="summary-badge badge-subject">{selectedSubject.name} ✓</span>}
        </div>
      )}
    </div>
  );
}

function getArabicOrdinalWeek(n: number): string {
  const ordinals: { [key: number]: string } = {
    1: 'الأسبوع الأول',
    2: 'الأسبوع الثاني',
    3: 'الأسبوع الثالث',
    4: 'الأسبوع الرابع',
    5: 'الأسبوع الخامس',
    6: 'الأسبوع السادس',
    7: 'الأسبوع السابع',
    8: 'الأسبوع الثامن',
    9: 'الأسبوع التاسع',
    10: 'الأسبوع العاشر',
    11: 'الأسبوع الحادي عشر',
    12: 'الأسبوع الثاني عشر',
    13: 'الأسبوع الثالث عشر',
    14: 'الأسبوع الرابع عشر',
    15: 'الأسبوع الخامس عشر',
    16: 'الأسبوع السادس عشر',
    17: 'الأسبوع السابع عشر',
    18: 'الأسبوع الثامن عشر',
    19: 'الأسبوع التاسع عشر',
    20: 'الأسبوع العشرون',
    21: 'الأسبوع الحادي والعشرون',
    22: 'الأسبوع الثاني والعشرون',
    23: 'الأسبوع الثالث والعشرون',
    24: 'الأسبوع الرابع والعشرون',
    25: 'الأسبوع الخامس والعشرون',
    26: 'الأسبوع السادس والعشرون',
    27: 'الأسبوع السابع والعشرون',
    28: 'الأسبوع الثامن والعشرون',
    29: 'الأسبوع التاسع والعشرون',
    30: 'الأسبوع الثلاثون',
    31: 'الأسبوع الحادي والثلاثون',
    32: 'الأسبوع الثاني والثلاثون',
    33: 'الأسبوع الثالث والثلاثون',
    34: 'الأسبوع الرابع والثلاثون',
    35: 'الأسبوع الخامس والثلاثون',
    36: 'الأسبوع السادس والثلاثون',
    37: 'الأسبوع السابع والثلاثون',
    38: 'الأسبوع الثامن والثلاثون',
    39: 'الأسبوع التاسع والثلاثون',
    40: 'الأسبوع الأربعون',
  };
  return ordinals[n] || `الأسبوع ${n}`;
}

// ── Syllabus Page ──
function SyllabusPage({ f, notify }: { f: FilterState; notify: (t: 'success' | 'error', m: string) => void }) {
  const [weeks, setWeeks] = useState<SyllabusWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [weekNum, setWeekNum] = useState(1);
  const [weekTitle, setWeekTitle] = useState('');
  const [weekType, setWeekType] = useState<'LESSON' | 'HOLIDAY' | 'EXAM'>('LESSON');
  const [startDatePicker, setStartDatePicker] = useState('');
  const [endDatePicker, setEndDatePicker] = useState('');
  const [hijriFrom, setHijriFrom] = useState('');
  const [hijriTo, setHijriTo] = useState('');
  const [gregFrom, setGregFrom] = useState('');
  const [gregTo, setGregTo] = useState('');
  // Refs always mirror picker state — guaranteed current, no stale closure
  const startPickerRef = useRef('');
  const endPickerRef = useRef('');
  // Pure mathematical Gregorian → Hijri conversion using integer truncation
  const gregToHijri = (isoDate: string): { d: number; m: number; y: number } | null => {
    if (!isoDate) return null;
    try {
      const dt = new Date(isoDate + 'T12:00:00');
      const year = dt.getFullYear(), month = dt.getMonth() + 1, day = dt.getDate();
      const T = Math.trunc;
      const jd = T((1461 * (year + 4800 + T((month - 14) / 12))) / 4)
               + T((367 * (month - 2 - 12 * T((month - 14) / 12))) / 12)
               - T((3 * T((year + 4900 + T((month - 14) / 12)) / 100)) / 4)
               + day - 32075;
      const l  = jd - 1948440 + 10632;
      const n  = T((l - 1) / 10631);
      const l2 = l - 10631 * n + 354;
      const j  = T((10985 - l2) / 5316) * T((50 * l2) / 17719)
               + T(l2 / 5670) * T((43 * l2) / 15238);
      const l3 = l2 - T((30 - j) / 15) * T((17719 * j) / 50)
               - T(j / 16) * T((15238 * j) / 43) + 29;
      const hm = T((24 * l3) / 709);
      const hd = l3 - T((709 * hm) / 24);
      const hy = 30 * n + j - 30;
      return { d: hd, m: hm, y: hy };
    } catch { return null; }
  };

  const getHijriDateStr = (isoDate: string) => {
    const h = gregToHijri(isoDate);
    if (!h) return '';
    return `${h.d}-${h.m}-${h.y} هـ`;
  };

  const getGregDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()} م`;
    } catch { return ''; }
  };

  // Compute a complete { hijriStr, gregStr } from two ISO date strings
  const computeDateStrings = (startIso: string, endIso: string) => {
    const hS = gregToHijri(startIso);
    const hE = gregToHijri(endIso);
    const dS = startIso ? new Date(startIso + 'T12:00:00') : null;
    const dE = endIso   ? new Date(endIso   + 'T12:00:00') : null;
    const hFrom = hS ? `${hS.d}-${hS.m}` : '';
    const hTo   = hE ? `${hE.d}-${hE.m}-${hE.y} هـ` : '';
    const gFrom = dS ? `${dS.getDate()}-${dS.getMonth() + 1}` : '';
    const gTo   = dE ? `${dE.getDate()}-${dE.getMonth() + 1}-${dE.getFullYear()} م` : '';
    return {
      hijriStr: hFrom && hTo ? `من ${hFrom} إلى ${hTo}` : '',
      gregStr:  gFrom && gTo ? `من ${gFrom} إلى ${gTo}` : '',
    };
  };

  const handleStartDatePickerChange = (val: string) => {
    setStartDatePicker(val);
    startPickerRef.current = val;
    if (val) {
      const h = gregToHijri(val);
      const d = new Date(val + 'T12:00:00');
      setHijriFrom(h ? `${h.d}-${h.m}` : '');
      setGregFrom(`${d.getDate()}-${d.getMonth() + 1}`);
    }
  };

  const handleEndDatePickerChange = (val: string) => {
    setEndDatePicker(val);
    endPickerRef.current = val;
    if (val) {
      const h = gregToHijri(val);
      const d = new Date(val + 'T12:00:00');
      setHijriTo(h ? `${h.d}-${h.m}-${h.y} هـ` : '');
      setGregTo(`${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()} م`);
    }
  };

  useEffect(() => {
    if (f.gradeSubjectId) { setLoading(true); loadWeeks(); }
    else setWeeks([]);
  }, [f.gradeSubjectId]);

  const loadWeeks = async () => {
    try {
      const data = await api.getSyllabusWeeks(f.gradeSubjectId);
      setWeeks(data);
      if (data.length > 0) setWeekNum(data[data.length - 1].weekNumber + 1);
    } catch { notify('error', 'فشل تحميل الأسابيع.'); }
    finally { setLoading(false); }
  };

  const handleOpenAddModal = () => {
    setShowAdd(true);
    let startDate = new Date();
    
    // Auto-advance date from last week if available
    if (weeks.length > 0) {
      const lastW = weeks[weeks.length - 1];
      if (lastW.endDateHijri) {
        // extract greg date if available or advance by 7 days
        startDate.setDate(startDate.getDate() + 7);
      }
    }

    const startIso = startDate.toISOString().split('T')[0];
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4);
    const endIso = endDate.toISOString().split('T')[0];

    startPickerRef.current = startIso;
    endPickerRef.current   = endIso;

    setStartDatePicker(startIso);
    setEndDatePicker(endIso);
    const hS = gregToHijri(startIso);
    const hE = gregToHijri(endIso);
    const dS = new Date(startIso + 'T12:00:00');
    const dE = new Date(endIso + 'T12:00:00');
    setHijriFrom(hS ? `${hS.d}-${hS.m}` : '');
    setGregFrom(`${dS.getDate()}-${dS.getMonth() + 1}`);
    setHijriTo(hE ? `${hE.d}-${hE.m}-${hE.y} هـ` : '');
    setGregTo(`${dE.getDate()}-${dE.getMonth() + 1}-${dE.getFullYear()} م`);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { hijriStr, gregStr } = computeDateStrings(
        startPickerRef.current,
        endPickerRef.current
      );

      let finalHijri = hijriStr;
      let finalGreg  = gregStr;
      const hf = hijriFrom.trim(), ht = hijriTo.trim();
      const gf = gregFrom.trim(),  gt = gregTo.trim();
      if (hf && ht) finalHijri = `من ${hf} إلى ${ht}`;
      if (gf && gt) finalGreg  = `من ${gf} إلى ${gt}`;

      if (!finalHijri) finalHijri = 'من -- إلى --';
      if (!finalGreg)  finalGreg  = 'من -- إلى --';

      const createdWeek = await api.createSyllabusWeek(f.gradeSubjectId, weekNum, weekTitle, {
        startDateHijri: finalHijri,
        endDateHijri:   finalGreg,
        weekType,
      });

      notify('success', 'تمت الإضافة بنجاح.');
      setShowAdd(false);
      setWeekTitle('');
      startPickerRef.current = ''; endPickerRef.current = '';
      setStartDatePicker(''); setEndDatePicker('');
      setHijriFrom(''); setHijriTo(''); setGregFrom(''); setGregTo('');
      setWeekType('LESSON');

      // Update state directly with returned createdWeek object (Instant UI update!)
      setWeeks(prev => {
        const list = prev.filter(w => w.id !== createdWeek.id && w.weekNumber !== createdWeek.weekNumber);
        return [...list, createdWeek].sort((a, b) => a.weekNumber - b.weekNumber);
      });
      setWeekNum(prev => prev + 1);
    } catch (err: any) { notify('error', err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف الأسبوع؟')) return;
    try { await api.deleteSyllabusWeek(id); notify('success', 'تم الحذف.'); loadWeeks(); }
    catch { notify('error', 'فشل الحذف.'); }
  };

  const selStage = f.stages.find(s => s.id === f.stageId);
  const selGrade = f.grades.find(g => g.id === f.gradeId);
  const selSemester = f.semesters.find(s => s.id === f.semesterId);
  const selSubject = f.subjects.find(s => s.gradeSubjectId === f.gradeSubjectId || s.subjectId === f.subjectId);

  const subjectName = selSubject?.name || 'التربية الفنية';
  const gradeName = selGrade?.name || 'الصف الأول الابتدائي';
  const semesterName = selSemester?.name || 'الفصل الدراسي الأول';

  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-syllabus');
    if (!el) { notify('error', 'عنصر المعاينة غير موجود، أعد فتح النافذة'); return; }

    setPdfLoading(true);
    let clone: HTMLElement | null = null;

    try {
      // Clone positioned on-screen at (0,0) so Chromium calculates exact Arabic glyph bounds
      clone = el.cloneNode(true) as HTMLElement;

      Object.assign(clone.style, {
        position: 'fixed',
        left: '0px',
        top: '0px',
        width: '1160px',
        maxHeight: 'none',
        overflow: 'visible',
        background: '#ffffff',
        direction: 'rtl',
        fontFamily: "'Cairo', sans-serif",
        letterSpacing: 'normal',
        wordSpacing: 'normal',
        padding: '24px',
        boxSizing: 'border-box',
        zIndex: '999999',
        opacity: '1',
      });
      document.body.appendChild(clone);

      // Delay to let browser layout & Arabic font shaping resolve completely
      await new Promise(r => setTimeout(r, 350));

      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
      });

      // Build multi-page A4 landscape PDF
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();  // 297mm
      const pageH = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 7;
      const printW = pageW - margin * 2;
      const pxPerMm = canvas.width / printW;
      const pageHeightPx = (pageH - margin * 2) * pxPerMm;

      let yOffset = 0;
      let pageNum = 0;

      while (yOffset < canvas.height) {
        if (pageNum > 0) pdf.addPage();

        const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceH);
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        // Use JPEG for smaller size & better browser support
        const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.93);
        pdf.addImage(sliceImg, 'JPEG', margin, margin, printW, sliceH / pxPerMm);

        yOffset += pageHeightPx;
        pageNum++;
      }

      // ASCII-safe filename to avoid Windows encoding issues
      pdf.save('syllabus-distribution.pdf');
      notify('success', 'تم تحميل الـ PDF بنجاح ✓');
    } catch (err: any) {
      console.error('PDF Error:', err);
      notify('error', 'فشل إنشاء PDF — تفاصيل: ' + String(err?.message || err));
    } finally {
      // Always remove clone from DOM
      if (clone && document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
      setPdfLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2><CalendarDays size={22} /> توزيع المنهج الأسبوعي</h2>
          <p>أضف وعدّل الأسابيع الدراسية — تظهر مباشرة في إضافة مدرستي</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {weeks.length > 0 && <span className="badge success">{weeks.length} أسبوع</span>}
          {f.gradeSubjectId && weeks.length > 0 && (
            <button
              className="btn-secondary"
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#fff',
                borderColor: '#0284c7',
                gap: 7,
                display: 'flex',
                alignItems: 'center',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 10,
                boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
                transition: 'all 0.18s',
              }}
              onClick={() => setShowPdfModal(true)}
            >
              <FileText size={15} /> تصدير PDF
            </button>
          )}
          {f.gradeSubjectId && (
            <button className="btn-primary" onClick={handleOpenAddModal}>
              <Plus size={16} /> إضافة أسبوع
            </button>
          )}
        </div>
      </div>

      {!f.gradeSubjectId ? (
        <div className="empty-state glass">
          <CalendarDays size={56} className="empty-icon" />
          <h3>حدد المادة أولاً</h3>
          <p>اختر المرحلة والصف والفصل والمادة من الشريط أعلاه لعرض أسابيع المنهج</p>
        </div>
      ) : loading ? (
        <div className="loading-state"><span className="spin large" /></div>
      ) : weeks.length === 0 ? (
        <div className="empty-state glass">
          <CalendarDays size={56} className="empty-icon" />
          <h3>لا توجد أسابيع بعد</h3>
          <p>اضغط «إضافة أسبوع» لبدء توزيع المنهج</p>
        </div>
      ) : (
        <div className="cards-grid">
          {weeks.map(w => {
            const isHoliday = w.weekType === 'HOLIDAY' || (w.title.includes('إجازة') && !w.title.includes('اليوم الوطني'));
            const isExam = w.weekType === 'EXAM' || w.title.includes('اختبار');
            let cardClass = 'week-card-v2';
            if (isHoliday) cardClass += ' is-holiday';
            else if (isExam) cardClass += ' is-exam';

            const parts = w.title.split('|').map(p => p.trim());

            return (
              <div key={w.id} className={cardClass}>
                <div className="wc-header">
                  <div className="wc-header-title">
                    {isHoliday ? '🌴 إجازة' : isExam ? '📝 اختبارات' : getArabicOrdinalWeek(w.weekNumber)}
                  </div>
                  <div className="wc-header-actions">
                    {w.activity && <span className="wc-badge-success">✓ نشاط</span>}
                    <button className="wc-delete-btn" title="حذف الأسبوع" onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="wc-body">
                  {(w.startDateHijri || w.endDateHijri) && (
                    <div className="wc-dates-box">
                      {w.startDateHijri && <div>{w.startDateHijri}</div>}
                      {w.endDateHijri && <div>{w.endDateHijri}</div>}
                    </div>
                  )}

                  <div className="wc-title-content">
                    {parts.map((part, pIdx) => {
                      const isNational = part.includes('اليوم الوطني');
                      return (
                        <div key={pIdx} className={`wc-title-part ${isNational ? 'is-national' : ''}`}>
                          {isNational ? '📍 ' : ''}{part}
                        </div>
                      );
                    })}
                  </div>

                  {w.activity && (
                    <div className="wc-activity-tag">
                      <Layers size={13} /> {w.activity.items?.length || 0} عنصر تفاعلي مرتبطة
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="overlay">
          <div className="modal glass" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={18} /> إضافة أسبوع دراسي
              </h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>

              {/* Week Number */}
              <div className="field">
                <label>رقم الأسبوع</label>
                <input type="number" min={1} max={40} value={weekNum}
                  onChange={e => setWeekNum(Number(e.target.value))} required />
              </div>

              {/* Week Type */}
              <div className="field">
                <label>نوع الأسبوع</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['LESSON', '📚 درس عادي', '#6c63ff'], ['HOLIDAY', '🌴 إجازة', '#f97316'], ['EXAM', '📝 اختبارات', '#10b981']] as const).map(([val, label, color]) => (
                    <button key={val} type="button"
                      onClick={() => setWeekType(val)}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 10, border: `2px solid ${weekType === val ? color : 'var(--border)'}`,
                        background: weekType === val ? `${color}22` : 'var(--bg2)',
                        color: weekType === val ? color : 'var(--text-2)',
                        fontFamily: 'Cairo', fontWeight: 700, fontSize: 12,
                        cursor: 'pointer', transition: 'all 0.18s',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content / Title */}
              <div className="field">
                <label>المحتوى / عنوان الوحدة</label>
                <textarea
                  placeholder={weekType === 'HOLIDAY' ? 'مثال: إجازة اليوم الوطني' : weekType === 'EXAM' ? 'مثال: اختبار منتصف الفصل' : 'مثال: مجال الرسم - الألوان الممتعة'}
                  value={weekTitle}
                  onChange={e => setWeekTitle(e.target.value)}
                  required
                  rows={3}
                  style={{ resize: 'vertical', minHeight: 64 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>للمحتوى المتعدد استخدم | للفصل بينها مثال: مجال الرسم | مراجعة</span>
              </div>

              {/* Date Selection Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg2)', padding: 14, borderRadius: 12, border: '1.5px solid var(--primary-dim)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={16} /> حدد تواريخ الأسبوع (اختيار من التقويم):
                </span>

                {/* Interactive Calendar Date Pickers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>من تاريخ (بداية الأسبوع)</label>
                    <input
                      type="date"
                      value={startDatePicker}
                      onChange={e => handleStartDatePickerChange(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 8,
                        border: '1.5px solid var(--primary)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontFamily: 'Cairo',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>إلى تاريخ (نهاية الأسبوع)</label>
                    <input
                      type="date"
                      value={endDatePicker}
                      onChange={e => handleEndDatePickerChange(e.target.value)}
                      style={{
                        padding: '9px 12px',
                        fontSize: 13,
                        borderRadius: 8,
                        border: '1.5px solid var(--primary)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontFamily: 'Cairo',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>

                {/* Calculated Hijri & Gregorian values */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>التواريخ المحسوبة تلقائياً (يمكن التعديل):</span>
                  
                  {/* Hijri */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>من (هجري)</label>
                      <input type="text" placeholder="مثال: 14-5"
                        value={hijriFrom} onChange={e => setHijriFrom(e.target.value)} />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>إلى (هجري)</label>
                      <input type="text" placeholder="مثال: 18-5-1448 هـ"
                        value={hijriTo} onChange={e => setHijriTo(e.target.value)} />
                    </div>
                  </div>

                  {/* Gregorian */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>من (عام / ميلادي)</label>
                      <input type="text" placeholder="مثال: 25-10"
                        value={gregFrom} onChange={e => setGregFrom(e.target.value)} />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>إلى (عام / ميلادي)</label>
                      <input type="text" placeholder="مثال: 29-10-2026 م"
                        value={gregTo} onChange={e => setGregTo(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>إلغاء</button>
                <button type="submit" className="btn-primary"><Plus size={15} /> إضافة الأسبوع</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPdfModal && (
        <div className="overlay printable-overlay">
          <div className="modal modal-xl glass printable-modal-content" style={{ maxWidth: 1150, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-head no-print" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Printer size={22} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0 }}>معاينة وتصدير جدول توزيع المنهج (PDF)</h3>
                  <span className="sub">نموذج رسمي معتمد بشعار منصة وسيلة</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  disabled={pdfLoading}
                  style={{
                    background: pdfLoading ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                    borderColor: '#0284c7',
                    gap: 8,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9px 20px',
                    fontWeight: 700,
                    fontSize: 14,
                    borderRadius: 10,
                    cursor: pdfLoading ? 'not-allowed' : 'pointer',
                    boxShadow: pdfLoading ? 'none' : '0 2px 10px rgba(2,132,199,0.4)',
                  }}
                  onClick={handleDownloadPdf}
                >
                  {pdfLoading
                    ? <><span className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> جاري إنشاء... </>
                    : <><Download size={16} /> تحميل PDF</>
                  }
                </button>
                <button className="icon-btn" onClick={() => setShowPdfModal(false)}><X size={20} /></button>
              </div>
            </div>

            <div className="printable-sheet" id="printable-syllabus">
              {/* Top Header */}
              <div className="ps-header">
                <div className="ps-header-side">
                  <div className="ps-moe-logo">
                    <span className="ps-moe-title">وزارة التعليم</span>
                    <span className="ps-moe-sub">Ministry of Education</span>
                    <span className="ps-moe-sub" style={{ fontSize: 9, marginTop: 2 }}>مدرسة: .....................</span>
                  </div>
                </div>

                <div className="ps-header-center">
                  <h1>توزيع المنهج</h1>
                  <p>لمادة: {subjectName}</p>
                </div>

                <div className="ps-header-side left">
                  <div className="ps-wsylh-brand">
                    <img src="/wsylh-logo-icon.png?v=5" alt="وسيلة" className="ps-brand-logo" />
                  </div>
                </div>
              </div>

              {/* Sub-Header info bar */}
              <div className="ps-info-bar">
                <div className="ps-info-item">
                  <span className="ps-info-label">المادة:</span>
                  <span className="ps-info-val">{subjectName}</span>
                </div>
                <div className="ps-info-item">
                  <span className="ps-info-label">الصف:</span>
                  <span className="ps-info-val">{gradeName}</span>
                </div>
                <div className="ps-info-item">
                  <span className="ps-info-label">الفصل:</span>
                  <span className="ps-info-val">{semesterName}</span>
                </div>
                <div className="ps-info-item">
                  <span className="ps-info-label">للعام:</span>
                  <span className="ps-info-val">1448 هـ (2026 - 2027 م)</span>
                </div>
              </div>

              {/* Weeks Grid */}
              <div className="ps-weeks-grid">
                {weeks.map((w, index) => {
                  const isHoliday = w.weekType === 'HOLIDAY' || (w.title.includes('إجازة') && !w.title.includes('اليوم الوطني'));
                  const isExam = w.title.includes('اختبار');
                  const parts = w.title.split('|').map(p => p.trim());

                  let cardClass = 'ps-week-card';
                  if (isHoliday) cardClass += ' is-holiday';
                  else if (isExam) cardClass += ' is-exam';

                  let displayHeader = isHoliday ? 'إجازة' : getArabicOrdinalWeek(w.weekNumber);

                  return (
                    <div key={w.id} className={cardClass}>
                      <div className="ps-week-head">
                        <span>{displayHeader}</span>
                      </div>
                      <div className="ps-week-body">
                        {(w.startDateHijri || w.endDateHijri) && (
                          <div className="ps-card-dates">
                            {w.startDateHijri && <div>{w.startDateHijri}</div>}
                            {w.endDateHijri && <div>{w.endDateHijri}</div>}
                          </div>
                        )}
                        {parts.map((p, idx) => {
                          const isSpecialBadge = p.includes('إجازة اليوم الوطني');
                          if (isSpecialBadge) {
                            return (
                              <div key={idx} className="ps-national-badge">
                                <span>📍 {p}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="ps-week-part">
                              {parts.length > 1 && <span className="ps-bullet">•</span>}
                              <span>{p}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Signatures Footer */}
              <div className="ps-footer">
                <div className="ps-signature">
                  <span>معلم المادة: .......................................</span>
                </div>
                <div className="ps-signature">
                  <span>مدير المدرسة: .......................................</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getActivityUrl(input: string): string {
  if (!input) return "";
  let str = input.trim();
  if (str.includes("<iframe")) {
    const doc = new DOMParser().parseFromString(str, "text/html");
    const src = doc.querySelector("iframe")?.getAttribute("src");
    if (src) str = src.trim();
  }
  if (str.includes("wordwall.net/resource/")) {
    str = str.replace("wordwall.net/resource/", "wordwall.net/embed/");
  }
  if (str.startsWith("wordwall.net/") || str.startsWith("www.wordwall.net/")) {
    str = "https://" + str;
  } else if (!str.startsWith("http://") && !str.startsWith("https://") && !str.startsWith("/") && !str.startsWith("blob:") && !str.startsWith("data:")) {
    if (str.includes("wordwall.net")) {
      str = "https://" + str;
    } else if (str.includes("themeId=") || str.includes("templateId=")) {
      str = "https://wordwall.net/embed/interactive?" + str;
    } else if (str.length > 0) {
      str = "https://" + str;
    }
  }
  return str;
}

const extractVideoThumbnail = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => { video.currentTime = Math.min(1, video.duration || 0); };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        if (blob) resolve(blob);
        else reject(new Error('Failed to create thumbnail'));
      }, 'image/jpeg');
    };
    video.onerror = () => reject(new Error('Failed to load video'));
  });
};

// ── Activities Page ──
function ActivitiesPage({ f, notify, theme }: { f: FilterState; notify: (t: 'success' | 'error', m: string) => void; theme: Theme }) {
  const [activities, setActivities] = useState<LessonActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LessonActivity | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [items, setItems] = useState<LessonActivityItem[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [viewingItem, setViewingItem] = useState<LessonActivityItem | null>(null);

  useEffect(() => {
    if (f.gradeSubjectId) { setLoading(true); loadActivities(); }
    else setActivities([]);
  }, [f.gradeSubjectId]);

  const loadActivities = async () => {
    try {
      const acts: LessonActivity[] = await api.getActivities(f.gradeSubjectId);
      setActivities(acts);
    } catch { notify('error', 'فشل تحميل الأنشطة.'); }
    finally { setLoading(false); }
  };

  const openNew = () => { setEditingActivity(null); setLessonTitle(''); setItems([]); setShowEditor(true); };
  const openEdit = (act: LessonActivity) => { setEditingActivity(act); setLessonTitle(act.lessonTitle); setItems(act.items || []); setShowEditor(true); };

  const handleSave = async () => {
    if (!lessonTitle.trim()) { notify('error', 'أدخل عنوان الدرس.'); return; }
    try {
      await api.saveActivity({
        id: editingActivity?.id,
        gradeSubjectId: f.gradeSubjectId,
        lessonTitle: lessonTitle.trim(),
        items: items.map(i => ({
          type: i.type,
          title: i.title || 'نشاط',
          url: getActivityUrl(i.url || ''),
          filePath: i.filePath,
          thumbnailUrl: i.thumbnailUrl
        }))
      });
      notify('success', 'تم الحفظ بنجاح.'); setShowEditor(false); loadActivities();
    } catch (e: any) { notify('error', e.message || 'فشل الحفظ.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف النشاط؟')) return;
    try { await api.deleteActivity(id); notify('success', 'تم الحذف.'); loadActivities(); }
    catch { notify('error', 'فشل الحذف.'); }
  };

  const addItem = () => setItems(p => [...p, { type: 'GAME', title: '', url: '' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const changeItem = (i: number, field: keyof LessonActivityItem, val: string) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleUpload = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingIdx(i);
    try {
      const res = await api.uploadFile(file);
      let thumbUrl = undefined;
      if (file.type.startsWith('video/')) {
        try {
          const thumbBlob = await extractVideoThumbnail(file);
          const thumbFile = new File([thumbBlob], `thumb_${file.name}.jpg`, { type: 'image/jpeg' });
          const thumbRes = await api.uploadFile(thumbFile);
          thumbUrl = thumbRes.url;
        } catch (err) { console.error('Thumbnail extraction failed', err); }
      }
      setItems(p => p.map((it, idx) => idx === i ? { ...it, url: res.url, filePath: res.url, title: it.title || file.name, thumbnailUrl: thumbUrl || it.thumbnailUrl } : it));
      notify('success', 'تم الرفع بنجاح.');
    } catch { notify('error', 'فشل الرفع.'); }
    finally { setUploadingIdx(null); }
  };

  const handleThumbnailUpload = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingIdx(i);
    try {
      const res = await api.uploadFile(file);
      setItems(p => p.map((it, idx) => idx === i ? { ...it, thumbnailUrl: res.url } : it));
      notify('success', 'تم رفع صورة الغلاف بنجاح.');
    } catch { notify('error', 'فشل رفع الصورة.'); }
    finally { setUploadingIdx(null); }
  };

  const handleUrlChange = (i: number, val: string) => {
    changeItem(i, 'url', getActivityUrl(val));
  };

  const typeIcon = (type: string) => {
    if (type === 'GAME') return <Gamepad2 size={14} className="icon-game" />;
    if (type === 'PRESENTATION') return <Tv size={14} className="icon-pres" />;
    if (type === 'PDF') return <FileText size={14} className="icon-pdf" />;
    return <LinkIcon size={14} className="icon-link" />;
  };

  const typeIconLg = (type: string) => {
    if (type === 'GAME') return <Gamepad2 size={48} style={{ color: 'var(--success)', filter: 'drop-shadow(0 4px 14px rgba(32,217,160,0.35))' }} />;
    if (type === 'PRESENTATION') return <Tv size={48} style={{ color: '#a855f7', filter: 'drop-shadow(0 4px 14px rgba(168,85,247,0.35))' }} />;
    if (type === 'PDF') return <FileText size={48} style={{ color: 'var(--danger)', filter: 'drop-shadow(0 4px 14px rgba(240,84,116,0.35))' }} />;
    return <LinkIcon size={48} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 4px 14px rgba(79,142,247,0.35))' }} />;
  };
  const typeLabel = (t: string) => ({ GAME: '🎮 لعبة', PRESENTATION: '📊 عرض', PDF: '📄 PDF', VIDEO: '🎥 فيديو' }[t] || t);

  const typeColor = (t: string) => {
    if (t === 'GAME') return 'var(--success)';
    if (t === 'PRESENTATION') return '#a855f7';
    if (t === 'PDF') return 'var(--danger)';
    if (t === 'VIDEO') return 'var(--primary-2)';
    return 'var(--primary)';
  };

  const typeClass = (t: string) => {
    if (t === 'GAME') return 'type-game';
    if (t === 'PRESENTATION') return 'type-pres';
    if (t === 'PDF') return 'type-pdf';
    if (t === 'VIDEO') return 'type-video';
    return 'type-default';
  };

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2><Layers size={22} /> إدارة الأنشطة</h2>
          <p>أضف ألعاباً وعروضاً وملفات — تظهر مباشرةً في إضافة مدرستي</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {f.gradeSubjectId && (
            <button className="btn-primary lg" onClick={openNew}>
              <Plus size={20} /> إنشاء نشاط جديد
            </button>
          )}
        </div>
      </div>

      {f.gradeSubjectId && activities.length > 0 && (
        <div className="activities-toolbar">
          <div className="toolbar-left">
            <h3>الأنشطة</h3>
            <span className="badge">{activities.length} نشاط</span>
          </div>
          <div className="toolbar-right">
            <div className="search-box">
              <span className="icon">🔍</span>
              <input type="text" placeholder="بحث عن نشاط..." />
            </div>
            <button className="btn-ghost sm">ترتيب ▼</button>
          </div>
        </div>
      )}

      {!f.gradeSubjectId ? (
        <div className="empty-state glass">
          <Layers size={56} className="empty-icon" />
          <h3>حدد المادة أولاً</h3>
          <p>اختر المرحلة والصف والفصل والمادة من الشريط أعلاه لعرض الأنشطة</p>
        </div>
      ) : loading ? (
        <div className="loading-state"><span className="spin large" /></div>
      ) : activities.length === 0 ? (
        <div className="empty-state glass">
          <Layers size={56} className="empty-icon" />
          <h3>لا توجد أنشطة بعد</h3>
          <p>اضغط «نشاط جديد» لربط محتوى تفاعلي بالدروس</p>
        </div>
      ) : (
        <div className="activity-cards">
          {activities.map(act => {
            const mainType = act.items.length > 0 ? act.items[0].type : 'UNKNOWN';
            const coverItem = act.items.find(it => !!it.thumbnailUrl) || (act.items.length > 0 ? act.items[0] : null);
            const hasCover = coverItem?.thumbnailUrl;
            return (
              <div key={act.id} className={`activity-card-v2 ${typeClass(mainType)}`}>
                <div className="ac-content" onClick={() => act.items.length > 0 && setViewingItem(act.items[0])}>
                  {hasCover ? (
                    <div className="ac-cover">
                      <img
                        src={hasCover}
                        alt="غلاف النشاط"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="ac-cover-badge" style={{ color: typeColor(mainType) }}>
                        {typeIcon(mainType)}
                      </div>
                    </div>
                  ) : (
                    <div className="ac-cover ac-cover-placeholder" style={{ background: 'transparent' }}>
                      {typeIconLg(mainType)}
                    </div>
                  )}
                  <div className="ac-info">
                    <div className="ac-meta">
                      <span className="ac-meta-label">الدرس:</span>
                      <span className="ac-meta-value">{act.lessonTitle}</span>
                    </div>
                    {act.items[0]?.title && (
                      <div className="ac-meta">
                        <span className="ac-meta-label">النشاط:</span>
                        <span className="ac-meta-value">{act.items[0].title}</span>
                      </div>
                    )}
                    <div className="ac-tags">
                      {act.items.map((it, i) => (
                        <span key={i} className="ac-tag" onClick={(e) => { e.stopPropagation(); setViewingItem(it); }} title="انقر للعرض">
                          {typeIcon(it.type)} {typeLabel(it.type)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="ac-divider" />
                <div className="ac-actions">
                  <button className="btn-ghost sm" onClick={() => openEdit(act)}><Pencil size={14} /> تعديل</button>
                  <button className="btn-ghost sm" onClick={() => handleDelete(act.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /> حذف</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showEditor && (
        <div className="overlay">
          <div className="modal modal-xl glass">
            <div className="modal-head">
              <div>
                <h3>{editingActivity ? 'تعديل النشاط' : 'نشاط جديد'}</h3>
                <span className="sub">تُربط بعنوان الدرس في مدرستي</span>
              </div>
              <button className="icon-btn" onClick={() => setShowEditor(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>عنوان الدرس (كما يظهر في مدرستي)</label>
                <input type="text" placeholder="مثال: الجمع ضمن 100" value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} />
              </div>
              <div className="items-list">
                {items.map((it, i) => (
                  <div key={i} className="item-row glass">
                    <div className="item-row-top">
                      <select value={it.type} onChange={e => changeItem(i, 'type', e.target.value)} className="type-select">
                        <option value="GAME">🎮 لعبة</option>
                        <option value="PRESENTATION">📊 عرض</option>
                        <option value="PDF">📄 PDF</option>
                        <option value="VIDEO">🎥 فيديو</option>
                      </select>
                      <input type="text" placeholder="عنوان النشاط" value={it.title} onChange={e => changeItem(i, 'title', e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div className="field url-f">
                      <label>الرابط أو الكود</label>
                      <div className="url-row">
                        <input type="text" placeholder="رابط أو كود Embed..." value={it.url || ''} onChange={e => handleUrlChange(i, e.target.value)} />
                        {(it.type === 'PRESENTATION' || it.type === 'PDF' || it.type === 'VIDEO') && (
                          <label className="upload-btn" title="رفع ملف">
                            <input type="file" accept={it.type === 'PDF' ? '.pdf' : it.type === 'VIDEO' ? 'video/*' : '.pptx,.ppt'} onChange={e => handleUpload(i, e)} disabled={uploadingIdx !== null} />
                            {uploadingIdx === i ? <span className="spin tiny" /> : <Upload size={15} />}
                          </label>
                        )}
                        <label className="upload-btn" title="رفع صورة غلاف للملف" style={{ background: 'var(--primary-dim)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                          <input type="file" accept="image/*" onChange={e => handleThumbnailUpload(i, e)} disabled={uploadingIdx !== null} />
                          {uploadingIdx === i ? <span className="spin tiny" /> : <Image size={15} />}
                        </label>
                      </div>
                    </div>
                    {it.thumbnailUrl && (
                      <div style={{ marginTop: 8 }}>
                        <img src={it.thumbnailUrl} alt="غلاف" style={{ height: 60, borderRadius: 8, border: '1px solid var(--border)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8 }}>صورة الغلاف ✓</span>
                      </div>
                    )}
                    <button className="icon-btn danger" onClick={() => removeItem(i)} style={{ marginTop: 8 }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <button className="btn-ghost" onClick={addItem}><Plus size={15} /> إضافة عنصر</button>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setShowEditor(false)}>إلغاء</button>
              <button className="btn-primary" onClick={handleSave}><Save size={16} /> حفظ النشاط</button>
            </div>
          </div>
        </div>
      )}

      {viewingItem && (
        <div className="overlay" onClick={() => setViewingItem(null)}>
          <div className="viewer-modal" onClick={e => e.stopPropagation()}>
            <div className="viewer-head">
              <span>{typeIcon(viewingItem.type)} {viewingItem.title || 'معاينة النشاط'}</span>
              <button className="icon-btn" onClick={() => setViewingItem(null)}><X size={20} /></button>
            </div>
            <div className="viewer-body">
              {viewingItem.type === 'VIDEO' ? (
                <video src={viewingItem.url} controls autoPlay style={{ width: '100%', height: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
              ) : viewingItem.type === 'PRESENTATION' && (viewingItem.url?.endsWith('.pptx') || viewingItem.url?.endsWith('.ppt')) ? (
                viewingItem.url.includes('localhost') ? (
                  <div style={{ color: 'white', textAlign: 'center', padding: 20 }}>
                    <Tv size={48} style={{ opacity: 0.5, marginBottom: 15 }} />
                    <h3 style={{ marginBottom: 10 }}>لا يمكن عرض ملفات PowerPoint من السيرفر المحلي (Localhost)</h3>
                    <p style={{ opacity: 0.8, maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.6 }}>
                      عارض مايكروسوفت المدمج يتطلب رابطاً عاماً على الإنترنت. عند إطلاق المنصة على سيرفر حقيقي سيعمل العرض مباشرة داخل هذه النافذة!
                    </p>
                    <a href={viewingItem.url} download target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-flex', padding: '10px 20px', textDecoration: 'none', color: 'white' }}>
                      تحميل الملف لعرضه بجهازك مؤقتاً
                    </a>
                  </div>
                ) : (
                  <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewingItem.url!)}`} width="100%" height="100%" frameBorder="0" style={{ background: '#fff' }} />
                )
              ) : (
                <iframe src={viewingItem.url} width="100%" height="100%" frameBorder="0" allowFullScreen style={{ background: '#fff' }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activePage, setActivePage] = useState<Page>('curriculum');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [stages, setStages] = useState<Stage[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [stageId, setStageIdRaw] = useState('');
  const [trackId, setTrackId] = useState('');
  const [gradeId, setGradeIdRaw] = useState('');
  const [semesterId, setSemesterIdRaw] = useState('');
  const [subjectId, setSubjectIdRaw] = useState('');
  const [gradeSubjectId, setGradeSubjectId] = useState('');

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => { if (isAuthenticated) loadOptions(); }, [isAuthenticated]);
  const loadOptions = async () => {
    try {
      const [s, sem] = await Promise.all([api.getStages(), api.getSemesters()]);
      setStages(s); setSemesters(sem);
    } catch { notify('error', 'فشل تحميل الخيارات.'); }
  };

  const setStageId = (v: string) => {
    setStageIdRaw(v); setTrackId('');
    setGrades([]); setGradeIdRaw(''); setSubjects([]); setSubjectIdRaw(''); setSemesterIdRaw(''); setGradeSubjectId('');
    const stage = stages.find(s => s.id === v);
    if (!stage) { setTracks([]); return; }
    if (stageHasNoTracks(stage)) {
      setTracks([]);
      api.getGrades(v, '').then(setGrades).catch(() => { });
    } else {
      const realTracks = (stage?.tracks || []).filter(t => t.name !== 'عام');
      setTracks(realTracks.length > 0 ? stage?.tracks || [] : []);
    }
  };

  const setTrackIdFull = (v: string) => {
    setTrackId(v);
    setGradeIdRaw(''); setSubjects([]); setSubjectIdRaw(''); setSemesterIdRaw(''); setGradeSubjectId('');
    if (v && stageId) {
      api.getGrades(stageId, v).then(setGrades).catch(() => { });
    }
  };

  const setGradeId = (v: string) => {
    setGradeIdRaw(v);
    setSubjects([]); setSubjectIdRaw(''); setGradeSubjectId('');
    setSemesterIdRaw('');
  };
  const setSemesterId = (v: string) => { setSemesterIdRaw(v); setSubjectIdRaw(''); setGradeSubjectId(''); };
  const setSubjectId = async (v: string) => {
    setSubjectIdRaw(v);
    if (v && gradeId && semesterId) {
      const gs = subjects.find(s => s.subjectId === v);
      setGradeSubjectId(gs ? gs.gradeSubjectId : '');
    } else setGradeSubjectId('');
  };

  useEffect(() => {
    if (gradeId && semesterId) api.getSubjects(gradeId, semesterId).then(setSubjects).catch(() => { });
  }, [gradeId, semesterId]);

  const reloadSubjects = () => {
    if (gradeId && semesterId) api.getSubjects(gradeId, semesterId).then(setSubjects).catch(() => { });
  };

  const filterState: FilterState = {
    stages, semesters, tracks, grades, subjects,
    stageId, trackId, gradeId, semesterId, subjectId, gradeSubjectId,
    setStageId,
    setTrackId: setTrackIdFull,
    setGradeId,
    setSemesterId,
    setSubjectId,
    reloadSubjects,
  };

  // ── LOGIN PAGE ──
  if (!isAuthenticated) return (
    <div className="auth-wrap">
      <div className="auth-card glass">
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <button className="theme-toggle" onClick={toggleTheme} title="تبديل المظهر">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <div className="auth-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/wsylh-logo-icon.png?v=5"
            alt="WSYLH Logo"
            style={{ height: '80px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }}
          />
          <p>لوحة التحكم الإدارية</p>
        </div>
        <form onSubmit={async e => {
          e.preventDefault(); setLoginError(''); setIsLoadingAuth(true);
          try { await api.login(loginEmail, loginPassword); setIsAuthenticated(true); }
          catch (err: any) { setLoginError(err.message || 'فشل تسجيل الدخول.'); }
          finally { setIsLoadingAuth(false); }
        }}>
          {loginError && <div className="alert-error"><AlertCircle size={16} />{loginError}</div>}
          <div className="field"><label>البريد الإلكتروني</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required /></div>
          <div className="field"><label>كلمة المرور</label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required /></div>
          <button type="submit" className="btn-primary full-w" disabled={isLoadingAuth}>
            {isLoadingAuth ? <span className="spin" /> : 'دخول إلى لوحة التحكم'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── MAIN APP ──
  return (
    <div className="shell">
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {notification.message}
        </div>
      )}

      <header className="topbar">
        <div className="topbar-brand">
          <img
            src="/wsylh-logo-icon.png?v=5"
            alt="WSYLH Logo"
            style={{ height: '48px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </div>

        <nav className="topbar-nav">
          <button className={`nav-tab ${activePage === 'curriculum' ? 'active' : ''}`} onClick={() => setActivePage('curriculum')}>
            <Settings size={16} /> الهيكل الدراسي
          </button>
          <button className={`nav-tab ${activePage === 'syllabus' ? 'active' : ''}`} onClick={() => setActivePage('syllabus')}>
            <CalendarDays size={16} /> توزيع المنهج
          </button>
          <button className={`nav-tab ${activePage === 'activities' ? 'active' : ''}`} onClick={() => setActivePage('activities')}>
            <Layers size={16} /> الأنشطة
          </button>
        </nav>

        <div className="topbar-actions">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn-ghost sm" onClick={() => { removeToken(); setIsAuthenticated(false); }}>
            <LogOut size={15} /> خروج
          </button>
        </div>
      </header>

      <main className="content">
        {activePage !== 'curriculum' && <FilterBar f={filterState} />}
        {activePage === 'curriculum' && <CurriculumPage notify={notify} />}
        {activePage === 'syllabus' && <SyllabusPage f={filterState} notify={notify} />}
        {activePage === 'activities' && <ActivitiesPage f={filterState} notify={notify} theme={theme} />}
      </main>
    </div>
  );
}
