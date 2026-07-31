import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, getToken, removeToken } from './api';
import {
  LogOut, Plus, Trash2, Upload, Link as LinkIcon,
  FileText, Gamepad2, Tv, Save,
  CheckCircle, X, AlertCircle, CalendarDays, Layers,
  Settings, Pencil, Sun, Moon, ChevronRight,
  GraduationCap, BookMarked, Library, Image, Printer, Download, ArrowUpDown, BookOpen as _BookOpen
} from 'lucide-react';
import './index.css';

// ── Types ──
interface Grade { id: string; name: string; order: number; trackId: string; }
interface Track { id: string; name: string; order: number; stageId: string; grades: Grade[]; }
interface Stage { id: string; name: string; order: number; tracks: Track[]; }
interface Semester { id: string; name: string; order: number; gradeId: string; }
interface SubjectOption { gradeSubjectId: string; subjectId: string; name: string; }
interface LessonItem { id?: string; type: string; title: string; url?: string; filePath?: string; thumbnailUrl?: string; }
interface Lesson { id: string; gradeSubjectId: string; syllabusWeekId?: string | null; lessonTitle: string; items: LessonItem[]; }
type LessonActivityItem = LessonItem;
type LessonActivity = Lesson;
interface SyllabusWeek { id: string; gradeSubjectId: string; weekNumber: number; title: string; startDateHijri?: string | null; endDateHijri?: string | null; weekType?: string | null; activity?: Lesson | null; lesson?: Lesson | null; weekDays?: any[] | null; }

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

const SAUDI_SCHOOL_SUBJECTS = [
  'القرآن الكريم وتجويده',
  'الدراسات الإسلامية',
  'لغتي',
  'لغتي الجميلة',
  'لغتي الخالدة',
  'الرياضيات',
  'العلوم',
  'اللغة الإنجليزية',
  'الدراسات الاجتماعية',
  'المهارات الرقمية',
  'التربية الفنية',
  'التربية البدنية والدفاع عن النفس',
  'المهارات الحياتية والأسرية',
  'التفكير الناقد',
  'الكيمياء',
  'الفيزياء',
  'الأحياء',
  'علم البيئة',
  'التقنية الرقمية',
  'المعرفة المالية',
  'اللياقة والثقافة الصحية',
  'الفنون',
  'التصميم الهندسي',
  'مبادئ القانون',
  'مبادئ الاقتصاد',
  'الإدارة المالية',
  'صناعة القرار في الأعمال'
];

function AddSubjectDropdown({ onSave, onCancel }: { onSave: (v: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState('');
  const [customVal, setCustomVal] = useState('');

  const handleConfirm = () => {
    const valueToSave = selected === '__custom__' ? customVal.trim() : selected;
    if (valueToSave) {
      onSave(valueToSave);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--primary-dim)', borderRadius: 10, border: '1.5px dashed var(--primary)', flexWrap: 'wrap', marginTop: 6 }}>
      <select
        autoFocus
        value={selected}
        onChange={e => {
          setSelected(e.target.value);
          if (e.target.value && e.target.value !== '__custom__') {
            onSave(e.target.value);
          }
        }}
        style={{ flex: 1, minWidth: '220px', padding: '8px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1.5px solid var(--primary)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'Cairo', outline: 'none', cursor: 'pointer' }}
      >
        <option value="">-- اختر مادة من قائمة وزارة التعليم --</option>
        {SAUDI_SCHOOL_SUBJECTS.map(sub => (
          <option key={sub} value={sub}>{sub}</option>
        ))}
        <option value="__custom__">+ إضافة مادة أخرى (كتابة يدوية)...</option>
      </select>
      {selected === '__custom__' && (
        <input
          type="text"
          value={customVal}
          placeholder="اكتب اسم المادة الجديدة..."
          onChange={e => setCustomVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && customVal.trim()) handleConfirm(); if (e.key === 'Escape') onCancel(); }}
          style={{ flex: 1, minWidth: '160px', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'Cairo', outline: 'none' }}
        />
      )}
      {selected === '__custom__' && (
        <button className="btn-primary sm" onClick={handleConfirm}><Plus size={13} /> إضافة</button>
      )}
      <button className="btn-ghost sm" onClick={onCancel} title="إلغاء"><X size={13} /></button>
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
  const [selGradeSubjectId, setSelGradeSubjectId] = useState('');
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
    async () => { await api.deleteStage(stage.id); if (selStageId === stage.id) { setSelStageId(''); setSelTrackId(''); setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); } await loadStages(); }
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
    async () => { await api.deleteTrack(track.id); if (selTrackId === track.id) { setSelTrackId(''); setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); } await loadStages(); }
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
    async () => { await api.deleteGrade(grade.id); if (selGradeId === grade.id) { setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); setSemesters([]); } await loadStages(); }
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
      if (selSemId === sem.id) { setSelSemId(''); setSelGradeSubjectId(''); setGradeSubjects([]); }
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
    async () => { await api.removeSubjectFromGrade(sub.gradeSubjectId); if (selGradeSubjectId === sub.gradeSubjectId) setSelGradeSubjectId(''); await loadSubjects(selGradeId, selSemId); }
  );

  const pickStage = (s: Stage) => {
    if (selStageId === s.id) { setSelStageId(''); } else { setSelStageId(s.id); }
    setSelTrackId(''); setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); setSemesters([]); setGradeSubjects([]);
  };
  const pickTrack = (t: Track) => {
    if (selTrackId === t.id) { setSelTrackId(''); } else { setSelTrackId(t.id); }
    setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); setSemesters([]); setGradeSubjects([]);
  };
  const pickGrade = (g: Grade) => {
    if (selGradeId === g.id) { setSelGradeId(''); setSelSemId(''); setSelGradeSubjectId(''); setSemesters([]); setGradeSubjects([]); }
    else { setSelGradeId(g.id); setSelSemId(''); setSelGradeSubjectId(''); setGradeSubjects([]); loadSemesters(g.id); }
  };
  const pickSem = (s: Semester) => {
    if (selSemId === s.id) { setSelSemId(''); setSelGradeSubjectId(''); setGradeSubjects([]); }
    else { setSelSemId(s.id); setSelGradeSubjectId(''); loadSubjects(selGradeId, s.id); }
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
                        {addingSubject && <AddSubjectDropdown onSave={handleAddSubject} onCancel={() => setAddingSubject(false)} />}
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
          <div className="filter-section" style={{ minWidth: 260 }}>
            <div className="filter-section-label">
              <span className="step-num">{showTracks ? '5' : '4'}</span> اختر المادة
            </div>
            <select
              className="select-input"
              value={f.subjectId || ''}
              onChange={e => f.setSubjectId(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 420,
                padding: '11px 16px',
                borderRadius: 12,
                border: '2px solid var(--primary)',
                background: 'var(--surface)',
                color: 'var(--text-1)',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 4px 12px rgba(2,132,199,0.15)'
              }}
            >
              <option value="">-- اختر المادة --</option>
              {f.subjects.map(s => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.name}
                </option>
              ))}
            </select>
            {f.subjects.length === 0 && <span className="filter-empty">لا توجد مواد مرتبطة</span>}
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
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [weekNum, setWeekNum] = useState(1);
  const [weekTitle, setWeekTitle] = useState('');
  const [weekType, setWeekType] = useState<'LESSON' | 'HOLIDAY' | 'EXAM'>('LESSON');
  const [selectedRegion, setSelectedRegion] = useState<'GENERAL' | 'WESTERN'>('GENERAL');
  const [pdfSchoolName, setPdfSchoolName] = useState('');
  const [pdfTeacherName, setPdfTeacherName] = useState('');
  const [pdfPrincipalName, setPdfPrincipalName] = useState('');
  const [daysList, setDaysList] = useState<Array<{ day: string; type: 'LESSON' | 'HOLIDAY'; lessonTitle: string; fromCalendar?: boolean }>>([
    { day: 'الأحد', type: 'LESSON', lessonTitle: '', fromCalendar: false },
    { day: 'الاثنين', type: 'LESSON', lessonTitle: '', fromCalendar: false },
    { day: 'الثلاثاء', type: 'LESSON', lessonTitle: '', fromCalendar: false },
    { day: 'الأربعاء', type: 'LESSON', lessonTitle: '', fromCalendar: false },
    { day: 'الخميس', type: 'LESSON', lessonTitle: '', fromCalendar: false }
  ]);
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
      const l = jd - 1948440 + 10632;
      const n = T((l - 1) / 10631);
      const l2 = l - 10631 * n + 354;
      const j = T((10985 - l2) / 5316) * T((50 * l2) / 17719)
        + T(l2 / 5670) * T((43 * l2) / 15238);
      const l3 = l2 - T((30 - j) / 15) * T((17719 * j) / 50)
        - T(j / 16) * T((15238 * j) / 43) + 29;
      const hm = T((24 * l3) / 709);
      const hd = l3 - T((709 * hm) / 24);
      const hy = 30 * n + j - 30;
      return { d: hd, m: hm, y: hy };
    } catch { return null; }
  };



  // Compute a complete { hijriStr, gregStr } from two ISO date strings
  const computeDateStrings = (startIso: string, endIso: string) => {
    const hS = gregToHijri(startIso);
    const hE = gregToHijri(endIso);
    const dS = startIso ? new Date(startIso + 'T12:00:00') : null;
    const dE = endIso ? new Date(endIso + 'T12:00:00') : null;
    const hFrom = hS ? `${hS.d}-${hS.m}` : '';
    const hTo = hE ? `${hE.d}-${hE.m}-${hE.y} هـ` : '';
    const gFrom = dS ? `${dS.getDate()}-${dS.getMonth() + 1}` : '';
    const gTo = dE ? `${dE.getDate()}-${dE.getMonth() + 1}-${dE.getFullYear()} م` : '';
    return {
      hijriStr: hFrom && hTo ? `من ${hFrom} إلى ${hTo}` : '',
      gregStr: gFrom && gTo ? `من ${gFrom} إلى ${gTo}` : '',
    };
  };

  const fetchAndPopulateCalendarDays = async (start: string, end: string, region: string) => {
    if (!start || !end) return;
    try {
      const calDays = await api.getCalendarDays(start, end, region);

      const newDaysList: Array<{ day: string; type: 'LESSON' | 'HOLIDAY'; lessonTitle: string; fromCalendar: boolean }> = [
        { day: 'الأحد', type: 'LESSON', lessonTitle: '', fromCalendar: false },
        { day: 'الاثنين', type: 'LESSON', lessonTitle: '', fromCalendar: false },
        { day: 'الثلاثاء', type: 'LESSON', lessonTitle: '', fromCalendar: false },
        { day: 'الأربعاء', type: 'LESSON', lessonTitle: '', fromCalendar: false },
        { day: 'الخميس', type: 'LESSON', lessonTitle: '', fromCalendar: false }
      ];

      calDays.forEach((cd: any) => {
        const dObj = new Date(cd.date);
        const dayIdx = dObj.getDay(); // 0 is Sunday
        if (dayIdx >= 0 && dayIdx <= 4) {
          newDaysList[dayIdx].type = cd.type === 'HOLIDAY' ? 'HOLIDAY' : 'LESSON';
          newDaysList[dayIdx].fromCalendar = true;
          if (cd.type === 'HOLIDAY') {
            newDaysList[dayIdx].lessonTitle = cd.note || 'إجازة رسمية';
          }
        }
      });

      setDaysList(newDaysList);
    } catch (e) {
      console.error('Failed to auto-populate calendar days:', e);
    }
  };

  // Re-fetch calendar days when region tab changes while a week is already chosen
  useEffect(() => {
    if (startDatePicker && endDatePicker) {
      fetchAndPopulateCalendarDays(startDatePicker, endDatePicker, selectedRegion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  useEffect(() => {
    if (f.gradeSubjectId) { setLoading(true); loadWeeks(); }
    else setWeeks([]);
  }, [f.gradeSubjectId, selectedRegion]);

  const loadWeeks = async () => {
    try {
      const data = await api.getSyllabusWeeks(f.gradeSubjectId, selectedRegion);
      const safeData = Array.isArray(data) ? data : [];
      setWeeks(safeData);
      if (safeData.length > 0) {
        setWeekNum(safeData[safeData.length - 1].weekNumber + 1);
      } else {
        setWeekNum(1);
      }
    } catch (err) {
      // Quietly fall back to empty array for region without showing a failure toast
      setWeeks([]);
      setWeekNum(1);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingWeekId(null);
    setShowAdd(true);
    setWeekTitle('');
    setWeekType('LESSON');
    let startDate = new Date();

    // Auto-advance date from last week if available
    if (weeks.length > 0) {
      const lastW = weeks[weeks.length - 1];
      if (lastW.endDateHijri) {
        startDate.setDate(startDate.getDate() + 7);
      }
    }

    const startIso = startDate.toISOString().split('T')[0];
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 4);
    const endIso = endDate.toISOString().split('T')[0];

    startPickerRef.current = startIso;
    endPickerRef.current = endIso;

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

  const handleOpenEditModal = (w: SyllabusWeek) => {
    setEditingWeekId(w.id);
    setWeekNum(w.weekNumber);
    setWeekTitle(w.title || '');
    setWeekType((w.weekType as any) || 'LESSON');

    // Parse dates from string
    if (w.startDateHijri) {
      const parts = w.startDateHijri.replace(/^من\s*/i, '').split(' إلى ');
      setHijriFrom(parts[0] || '');
      setHijriTo(parts[1] || '');
    } else {
      setHijriFrom(''); setHijriTo('');
    }

    if (w.endDateHijri) {
      const parts = w.endDateHijri.replace(/^من\s*/i, '').split(' إلى ');
      setGregFrom(parts[0] || '');
      setGregTo(parts[1] || '');
    } else {
      setGregFrom(''); setGregTo('');
    }

    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { hijriStr, gregStr } = computeDateStrings(
        startPickerRef.current,
        endPickerRef.current
      );

      let finalHijri = hijriStr;
      let finalGreg = gregStr;
      const hf = hijriFrom.trim(), ht = hijriTo.trim();
      const gf = gregFrom.trim(), gt = gregTo.trim();
      if (hf && ht) finalHijri = `من ${hf} إلى ${ht}`;
      if (gf && gt) finalGreg = `من ${gf} إلى ${gt}`;

      if (!finalHijri) finalHijri = 'من -- إلى --';
      if (!finalGreg) finalGreg = 'من -- إلى --';

      // Auto-join day titles for the week title if title is empty
      let finalTitle = weekTitle.trim();
      if (!finalTitle && weekType === 'LESSON') {
        finalTitle = daysList
          .map(d => `${d.day}: ${d.type === 'HOLIDAY' ? 'إجازة' : (d.lessonTitle || 'بلا درس')}`)
          .join(' | ');
      }

      const createdWeek = await api.createSyllabusWeek(f.gradeSubjectId, weekNum, finalTitle || 'أسبوع دراسي', {
        startDateHijri: finalHijri,
        endDateHijri: finalGreg,
        weekType,
        region: selectedRegion,
        days: daysList,
      });

      notify('success', editingWeekId ? 'تم التعديل بنجاح.' : 'تمت الإضافة بنجاح.');
      setShowAdd(false);
      setEditingWeekId(null);
      setWeekTitle('');
      startPickerRef.current = ''; endPickerRef.current = '';
      setStartDatePicker(''); setEndDatePicker('');
      setHijriFrom(''); setHijriTo(''); setGregFrom(''); setGregTo('');
      setWeekType('LESSON');
      setDaysList([
        { day: 'الأحد', type: 'LESSON', lessonTitle: '' },
        { day: 'الاثنين', type: 'LESSON', lessonTitle: '' },
        { day: 'الثلاثاء', type: 'LESSON', lessonTitle: '' },
        { day: 'الأربعاء', type: 'LESSON', lessonTitle: '' },
        { day: 'الخميس', type: 'LESSON', lessonTitle: '' }
      ]);

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
  const stageName = selStage?.name || 'المرحلة الابتدائية';
  const semesterName = selSemester?.name || 'الفصل الدراسي الأول';

  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-syllabus');
    if (!el) { notify('error', 'عنصر المعاينة غير موجود، أعد فتح النافذة'); return; }

    setPdfLoading(true);
    try {
      const htmlContent = el.outerHTML;
      const pdfTitle = `توزيع ${subjectName} ${gradeName} ${stageName}`.replace(/\s+/g, ' ').trim();

      const pdfExportUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
        ? 'http://localhost:4001/api/syllabus-weeks/export-pdf'
        : `${import.meta.env.VITE_API_URL || 'https://api.wsyelhi.com/api'}/syllabus-weeks/export-pdf`;

      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(pdfExportUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ html: htmlContent, title: pdfTitle }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes('application/json')) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `فشل إنشاء PDF عبر الخادم (رقم ${response.status})`);
      }

      const blobData = await response.blob();
      const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pdfTitle || 'syllabus-distribution'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1000);

      notify('success', 'تم توليد وتنزيل ملف الـ PDF بنجاح ✓');
    } catch (err: any) {
      console.error('Puppeteer Export Error:', err);
      notify('error', 'فشل تنزيل ملف الـ PDF: ' + (err.message || 'تحقق من تشغيل السيرفر'));
    } finally {
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

      {/* Region Selector Tab Row */}
      {f.gradeSubjectId && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, background: 'var(--bg2)', padding: 6, borderRadius: 10, width: 'fit-content', flexWrap: 'wrap' }}>
          {([['GENERAL', '🌍 التوزيع العام'], ['WESTERN', '📍 مكة المكرمة - جدة - الطائف']] as const).map(([rCode, rName]) => (
            <button
              key={rCode}
              type="button"
              onClick={() => setSelectedRegion(rCode)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: selectedRegion === rCode ? 'linear-gradient(135deg, #0d9488, #0f766e)' : 'transparent',
                color: selectedRegion === rCode ? '#fff' : 'var(--text-2)',
                fontFamily: 'Cairo',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {rName}
            </button>
          ))}
        </div>
      )}

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

            // Find holiday title from weekDays or title
            const holidayDay = Array.isArray(w.weekDays) ? (w.weekDays as any[]).find(d => d.type === 'HOLIDAY' && d.lessonTitle) : null;
            const holidayTitle = holidayDay ? holidayDay.lessonTitle : (w.title.includes('إجازة') ? w.title : '');

            // Split topics by slash, pipe or newline
            const topics = w.title
              .split(/[\/|\n]+/)
              .map(p => p.trim())
              .filter(Boolean);

            return (
              <div key={w.id} className={cardClass}>
                <div className="wc-header">
                  <div className="wc-header-title">
                    {isHoliday ? 'إجازة' : isExam ? 'اختبارات' : getArabicOrdinalWeek(w.weekNumber)}
                  </div>
                  <div className="wc-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {w.activity && <span className="wc-badge-success">✓ نشاط</span>}
                    <button className="wc-edit-btn" title="تعديل الأسبوع" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(w); }} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '4px 6px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={14} />
                    </button>
                    <button className="wc-delete-btn" title="حذف الأسبوع" onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="wc-body">
                  {(w.startDateHijri || w.endDateHijri) && (
                    <div className="wc-dates-box" style={{ borderRadius: 8, border: '1px dashed #0284c7', background: '#f0f9ff', padding: '6px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 10 }}>
                      {w.startDateHijri && <div>{w.startDateHijri}</div>}
                      {w.endDateHijri && <div>{w.endDateHijri}</div>}
                    </div>
                  )}

                  {holidayTitle && (
                    <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '8px 12px', color: '#991b1b', fontWeight: 700, textAlign: 'center', marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      🌴 📍 {holidayTitle.includes('إجازة') ? holidayTitle : `إجازة ${holidayTitle}`}
                    </div>
                  )}

                  <div className="wc-title-content" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center', marginTop: 6 }}>
                    {topics.length > 0 ? topics.map((topic, tIdx) => {
                      const isNational = topic.includes('اليوم الوطني');
                      return (
                        <div key={tIdx} style={{ fontSize: 13, fontWeight: 600, color: isNational ? '#b91c1c' : 'var(--text)', padding: '2px 0' }}>
                          {isNational ? '📍 ' : ''}{topic}
                        </div>
                      );
                    }) : (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>لا يوجد عنوان للأسبوع</div>
                    )}
                  </div>

                  {w.activity && (
                    <div className="wc-activity-tag" style={{ marginTop: 12 }}>
                      <Layers size={13} /> {w.activity.items?.length || 0} عنصر تفاعلي مرتبطة
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom PDF Export Action Bar */}
      {f.gradeSubjectId && weeks.length > 0 && (
        <div style={{
          marginTop: 28,
          marginBottom: 10,
          padding: '16px 24px',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(13, 148, 136, 0.12)', padding: 12, borderRadius: 12, color: 'var(--primary)' }}>
              <FileText size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>تصدير خطة توزيع المنهج (PDF)</h4>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-2)' }}>توليد مستند رسمي معتمد جاهز للطباعة والاعتماد</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            onClick={() => setShowPdfModal(true)}
          >
            <FileText size={18} /> تصدير PDF للمنهج
          </button>
        </div>
      )}

      {showAdd && (
        <div className="overlay">
          <div className="modal glass" style={{ maxWidth: weekType === 'LESSON' ? 880 : 500, width: '92%' }}>
            <div className="modal-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={18} /> {editingWeekId ? 'تعديل أسبوع دراسي' : 'إضافة أسبوع دراسي'}
              </h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: weekType === 'LESSON' ? '1.1fr 1fr' : '1fr', gap: 16, padding: '4px 0' }}>

              {/* Right Column (Basic Details & Dates) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Week Number & Type in one row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>رقم الأسبوع</label>
                    <input type="number" min={1} max={40} value={weekNum}
                      onChange={e => setWeekNum(Number(e.target.value))} required style={{ padding: '8px 10px', fontSize: 13 }} />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 12, fontWeight: 700 }}>نوع الأسبوع</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([['LESSON', '🟢 دراسة', '#e6f4ea', '#137333', '#a8dab5'], ['HOLIDAY', '🔴 إجازة', '#fce8e6', '#c5221f', '#f5c2c7'], ['EXAM', '📝 اختبار', '#e8f0fe', '#1a73e8', '#aecbfa']] as const).map(([val, label, bg, color, border]) => (
                        <button key={val} type="button"
                          onClick={() => setWeekType(val)}
                          style={{
                            flex: 1, padding: '7px 4px', borderRadius: 8,
                            border: `1.5px solid ${weekType === val ? border : 'var(--border)'}`,
                            background: weekType === val ? bg : 'var(--bg2)',
                            color: weekType === val ? color : 'var(--text-2)',
                            fontFamily: 'Cairo', fontWeight: 700, fontSize: 11,
                            cursor: 'pointer', transition: 'all 0.18s',
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Content / Title */}
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>الموضوعات والدروس للأسبوع</label>
                  <textarea
                    placeholder={weekType === 'HOLIDAY' ? 'مثال: إجازة اليوم الوطني (23 سبتمبر)' : 'ضع كل درس/موضوع في سطر مستقل أو افصل بينهما بـ / \nمثال:\nمجال الرسم - الإنسان والرسم\nمراجعة\nمجال الرسم - مدرستي الجميلة'}
                    value={weekTitle}
                    onChange={e => setWeekTitle(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 64, padding: '8px 10px', fontSize: 13 }}
                  />
                </div>

                {/* Date Selection Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg2)', padding: 10, borderRadius: 10, border: '1.5px solid var(--primary-dim)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} /> حدد تواريخ الأسبوع:
                  </span>

                  {/* Interactive Calendar Date Picker */}
                  <div className="field">
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>اختر تاريخ بداية الأسبوع (الأحد)</label>
                    <input
                      type="date"
                      value={startDatePicker}
                      onChange={e => {
                        const val = e.target.value;
                        if (val) {
                          const dObj = new Date(val);
                          const day = dObj.getDay(); // 0 is Sunday, 1 is Monday, etc.
                          let sunDate = new Date(dObj);
                          if (day !== 0) sunDate.setDate(dObj.getDate() - day);
                          const startIso = sunDate.toISOString().split('T')[0];
                          const thuDate = new Date(sunDate);
                          thuDate.setDate(sunDate.getDate() + 4);
                          const endIso = thuDate.toISOString().split('T')[0];

                          startPickerRef.current = startIso;
                          endPickerRef.current = endIso;

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

                          fetchAndPopulateCalendarDays(startIso, endIso, selectedRegion);
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1.5px solid var(--primary)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontFamily: 'Cairo',
                        fontWeight: 600,
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    />
                  </div>

                  {/* Calculated Hijri & Gregorian values */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)' }}>التواريخ المحسوبة (يمكن التعديل):</span>

                    {/* Hijri */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="field">
                        <label style={{ fontSize: 10 }}>من (هجري)</label>
                        <input type="text" placeholder="مثال: 15-2"
                          value={hijriFrom} onChange={e => setHijriFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 11 }} />
                      </div>
                      <div className="field">
                        <label style={{ fontSize: 10 }}>إلى (هجري)</label>
                        <input type="text" placeholder="مثال: 19-2"
                          value={hijriTo} onChange={e => setHijriTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 11 }} />
                      </div>
                    </div>

                    {/* Gregorian */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="field">
                        <label style={{ fontSize: 10 }}>من (ميلادي)</label>
                        <input type="text" placeholder="مثال: 31-7"
                          value={gregFrom} onChange={e => setGregFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 11 }} />
                      </div>
                      <div className="field">
                        <label style={{ fontSize: 10 }}>إلى (ميلادي)</label>
                        <input type="text" placeholder="مثال: 4-8-2026 م"
                          value={gregTo} onChange={e => setGregTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 11 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column (Days status, only for LESSON type) */}
              {weekType === 'LESSON' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg2)', padding: 12, borderRadius: 12, border: '1.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary)', margin: 0 }}>حالة أيام الأسبوع (الأحد - الخميس)</label>
                    <span style={{ fontSize: 9, color: 'var(--text-3)', fontStyle: 'italic' }}>
                      {startDatePicker ? '📅 محدد تلقائياً من التقويم' : 'اختر الأسبوع أولاً'}
                    </span>
                  </div>

                  {!startDatePicker && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-2)', textAlign: 'center',
                      padding: '16px 8px', borderRadius: 8,
                      border: '1.5px dashed var(--border)',
                      background: 'var(--surface)'
                    }}>
                      📅 اختر تاريخ بداية الأسبوع للتعرف على أيام الإجازة والدراسة تلقائياً
                    </div>
                  )}

                  {startDatePicker && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 4 }}>
                      {daysList.map((d) => (
                        <div key={d.day} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          padding: '10px 4px', borderRadius: 8, textAlign: 'center',
                          background: d.type === 'HOLIDAY' ? 'rgba(249,115,22,0.08)' : 'rgba(13,148,136,0.06)',
                          border: `1px solid ${d.type === 'HOLIDAY' ? 'rgba(249,115,22,0.25)' : 'rgba(13,148,136,0.20)'}`
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{d.day}</span>
                          <span style={{
                            padding: '3px 6px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                            background: d.type === 'HOLIDAY' ? '#f97316' : '#0d9488',
                            color: 'white', whiteSpace: 'nowrap'
                          }}>
                            {d.type === 'HOLIDAY' ? '🔴 إجازة' : '🟢 دراسة'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Modal footer, spanning across columns */}
              <div className="modal-foot" style={{ gridColumn: weekType === 'LESSON' ? 'span 2' : 'span 1', marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', fontSize: 13 }}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}><Plus size={15} /> إضافة الأسبوع</button>
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

            {/* Inputs bar for teacher metadata (non-printable) */}
            <div className="no-print" style={{ background: 'var(--bg2)', padding: '12px 16px', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>اسم المدرسة:</label>
                <input type="text" placeholder="اكتب اسم المدرسة هنا..." value={pdfSchoolName} onChange={e => setPdfSchoolName(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1.5px solid var(--border)' }} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>اسم المعلم / ة:</label>
                <input type="text" placeholder="اسم المعلم/ة..." value={pdfTeacherName} onChange={e => setPdfTeacherName(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1.5px solid var(--border)' }} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>اسم المدير / ة:</label>
                <input type="text" placeholder="اسم المدير/ة..." value={pdfPrincipalName} onChange={e => setPdfPrincipalName(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1.5px solid var(--border)' }} />
              </div>
            </div>

            <div className="printable-sheet printable-syllabus-sheet" id="printable-syllabus" style={{ padding: '12px', background: '#ffffff', width: '100%' }}>
              {/* Prestigious Light Ministry Executive Header */}
              <div
                className="ps-header"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 1fr',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                  color: '#0f172a',
                  padding: '10px 16px',
                  borderRadius: 12,
                  marginBottom: 10,
                  border: '1.5px solid #059669',
                  borderBottom: '3px solid #d97706',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.05)'
                }}
              >
                <div className="ps-header-side" style={{ textAlign: 'right' }}>
                  <div className="ps-moe-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 900, fontSize: 11.5, color: '#065f46', letterSpacing: 0.2 }}>المملكة العربية السعودية</span>
                    <span style={{ fontWeight: 800, fontSize: 11, color: '#0f172a' }}>وزارة التعليم</span>
                    <span style={{ fontWeight: 800, fontSize: 9.5, color: '#d97706', marginTop: 1 }}>إدارة التعليم العام</span>
                  </div>
                </div>

                <div className="ps-header-center" style={{ textAlign: 'center' }}>
                  <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#064e3b', letterSpacing: '-0.3px' }}>
                    {selectedRegion === 'GENERAL' ? 'الخطة الدراسية والتوزيع الزمني للمنهج' : 'توزيع المنهج المعتمد (مكة المكرمة - جدة - الطائف)'}
                  </h1>
                  <p style={{ margin: '3px 0 0 0', fontSize: 11, fontWeight: 800, color: '#0d9488' }}>
                    منصة وسيلة — المحتوى الدراسي لعام 1448 هـ
                  </p>
                </div>

                <div className="ps-header-side left" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <img src="/wsylh-logo-full.png?v=6" alt="وسيلة" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>

              {/* Sub-Header Light Royal Capsule Dashboard Bar */}
              <div
                className="ps-info-bar"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  background: 'linear-gradient(to left, #f0fdf4, #f0f9ff, #fffbeb)',
                  border: '1.5px solid #0284c7',
                  borderRadius: 8,
                  padding: '4px 10px',
                  marginBottom: 8,
                  textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(2, 132, 199, 0.05)'
                }}
              >
                <div className="ps-info-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span className="ps-info-label" style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', whiteSpace: 'nowrap' }}>📚 المادة:</span>
                  <span className="ps-info-val" style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{subjectName}</span>
                </div>
                <div className="ps-info-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRight: '1px solid #cbd5e1' }}>
                  <span className="ps-info-label" style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', whiteSpace: 'nowrap' }}>🎓 الصف:</span>
                  <span className="ps-info-val" style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{gradeName}</span>
                </div>
                <div className="ps-info-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRight: '1px solid #cbd5e1' }}>
                  <span className="ps-info-label" style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', whiteSpace: 'nowrap' }}>🗓️ الفصل:</span>
                  <span className="ps-info-val" style={{ fontSize: 11.5, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{semesterName}</span>
                </div>
                <div className="ps-info-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRight: '1px solid #cbd5e1' }}>
                  <span className="ps-info-label" style={{ fontSize: 10.5, fontWeight: 800, color: '#0369a1', whiteSpace: 'nowrap' }}>⏳ العام:</span>
                  <span className="ps-info-val" style={{ fontSize: 11.5, fontWeight: 900, color: '#0d9488', whiteSpace: 'nowrap' }}>1448 هـ (2026 - 2027 م)</span>
                </div>
              </div>

              {/* Executive Matrix Weeks Grid - 6 columns stretch */}
              <div className="ps-weeks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10, width: '100%' }}>
                {weeks.map((w) => {
                  const isHoliday = w.weekType === 'HOLIDAY' || (w.title.includes('إجازة') && !w.title.includes('اليوم الوطني'));
                  const isExam = w.weekType === 'EXAM' || w.title.includes('اختبار');
                  const parts = w.title.split('|').map(p => p.trim());

                  let cardClass = 'ps-week-card';
                  if (isHoliday) cardClass += ' is-holiday';
                  else if (isExam) cardClass += ' is-exam';

                  let displayHeader = isHoliday ? 'إجازة رسمية' : isExam ? 'أسبوع الاختبارات' : getArabicOrdinalWeek(w.weekNumber);

                  return (
                    <div
                      key={w.id}
                      className={cardClass}
                      style={{
                        border: isHoliday ? '1.5px solid #fca5a5' : isExam ? '1.5px solid #fde68a' : '1.5px solid #bfdbfe',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: isHoliday ? '#fff1f2' : isExam ? '#fffbeb' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div
                        className="ps-week-head"
                        style={{
                          background: isHoliday
                            ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                            : isExam
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#ffffff',
                          padding: '4px 6px',
                          fontWeight: 900,
                          fontSize: 10.5,
                          textAlign: 'center',
                          borderBottom: isHoliday ? '1.5px solid #fca5a5' : isExam ? '1.5px solid #fde68a' : '1.5px solid #93c5fd'
                        }}
                      >
                        <span>{displayHeader}</span>
                      </div>
                      <div className="ps-week-body" style={{ padding: '5px 6px', fontSize: 9.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 4 }}>
                        {(w.startDateHijri || w.endDateHijri) && (
                          <div
                            className="ps-card-dates"
                            style={{
                              background: '#f0f9ff',
                              border: '1px solid #7dd3fc',
                              borderRadius: 5,
                              padding: '2px 4px',
                              fontSize: 8.5,
                              color: '#0369a1',
                              textAlign: 'center',
                              fontWeight: 800,
                              marginBottom: 2,
                              lineHeight: 1.3
                            }}
                          >
                            <span>📅 </span>
                            {w.startDateHijri && <div style={{ display: 'inline' }}>{w.startDateHijri} </div>}
                            {w.endDateHijri && <div style={{ display: 'inline' }}>{w.endDateHijri}</div>}
                          </div>
                        )}
                        {(() => {
                          const isWeek5NationalDay = w.weekNumber === 5 && !parts.some(p => p.includes('اليوم الوطني') || p.includes('إجازة'));
                          const effectiveParts = isWeek5NationalDay
                            ? [parts[0] || 'مجال الرسم -> الإنسان والرسم', 'إجازة اليوم الوطني السعودي', ...parts.slice(1)].filter(Boolean)
                            : parts;

                          return effectiveParts.map((p, idx) => {
                            const isSpecialHoliday = p.includes('إجازة') || p.includes('عطلة') || p.includes('اليوم الوطني');
                            const isSpecialExam = p.includes('اختبار') || p.includes('تقويم') || p.includes('امتحان');

                            if (isSpecialHoliday) {
                              return (
                                <div
                                  key={idx}
                                  className="ps-national-badge"
                                  style={{
                                    background: '#fff1f2',
                                    color: '#9f1239',
                                    padding: '5px 6px',
                                    borderRadius: 8,
                                    border: '1.5px solid #fecdd3',
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    margin: '2px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    lineHeight: 1.3
                                  }}
                                >
                                  <span>📍</span>
                                  <span>🌴</span>
                                  <span>{p}</span>
                                </div>
                              );
                            }

                            if (isSpecialExam && !isExam) {
                              return (
                                <div
                                  key={idx}
                                  className="ps-exam-badge"
                                  style={{
                                    background: '#fffbeb',
                                    color: '#92400e',
                                    padding: '4px 6px',
                                    borderRadius: 6,
                                    border: '1.5px solid #fde68a',
                                    fontSize: 9,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    margin: '2px 0'
                                  }}
                                >
                                  <span>📝 {p}</span>
                                </div>
                              );
                            }

                            return (
                              <div key={idx} className="ps-week-item" style={{ display: 'flex', gap: 4, fontSize: 9, fontWeight: 700, color: '#1e293b', lineHeight: 1.3, alignItems: 'baseline' }}>
                                <span className="ps-item-bullet" style={{ color: '#d97706', fontWeight: 900, fontSize: 8 }}>❖</span>
                                <span>{p}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Official Ministry Verification & Signatures Table */}
              <div
                className="ps-footer-table"
                style={{
                  marginTop: 6,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 10,
                  padding: '5px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#1e293b',
                  width: '100%'
                }}
              >
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>المؤسسة التعليمية:</span>
                  <span style={{ fontWeight: 900, color: '#0f766e', fontSize: 11, whiteSpace: 'nowrap' }}>{pdfSchoolName || '........................................'}</span>
                </div>
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>توقيع معلم/ة المادة:</span>
                  <span style={{ fontWeight: 900, color: '#0f766e', fontSize: 11, whiteSpace: 'nowrap' }}>{pdfTeacherName || '........................................'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>اعتماد مدير/ة المدرسة:</span>
                  <span style={{ fontWeight: 900, color: '#0f766e', fontSize: 11, whiteSpace: 'nowrap' }}>{pdfPrincipalName || '........................................'}</span>
                </div>
              </div>

              {/* Official Bottom Verification Banner Line */}
              <div
                className="ps-footer-copyright"
                style={{
                  marginTop: 6,
                  padding: '4px 8px',
                  textAlign: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#64748b',
                  borderTop: '1px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <span>🌐</span>
                <span>تم الاعتماد والتوليد آلياً عبر نظام وسيلة المعتمَد — https://wsyelhi.com</span>
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
function ActivitiesPage({ f, notify, theme: _theme }: { f: FilterState; notify: (t: 'success' | 'error', m: string) => void; theme?: Theme }) {
  const [activities, setActivities] = useState<LessonActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LessonActivity | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [items, setItems] = useState<LessonActivityItem[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [viewingItem, setViewingItem] = useState<LessonActivityItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  const filteredActivities = activities
    .filter(act => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchLesson = act.lessonTitle?.toLowerCase().includes(q);
      const matchItem = act.items?.some(it => it.title?.toLowerCase().includes(q) || it.url?.toLowerCase().includes(q));
      return matchLesson || matchItem;
    })
    .sort((a, b) => {
      const titleA = a.lessonTitle || '';
      const titleB = b.lessonTitle || '';
      return sortOrder === 'asc'
        ? titleA.localeCompare(titleB, 'ar')
        : titleB.localeCompare(titleA, 'ar');
    });

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
            <span className="badge">{filteredActivities.length} نشاط</span>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-box">
              <span className="icon">🔍</span>
              <input
                type="text"
                placeholder="بحث عن نشاط أو درس..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="btn-secondary sm"
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              title="تغيير اتجاه الترتيب"
            >
              <ArrowUpDown size={14} /> الترتيب: {sortOrder === 'asc' ? 'أبجدي (أ - ي)' : 'تنازلي (ي - أ)'}
            </button>
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
      ) : filteredActivities.length === 0 ? (
        <div className="empty-state glass">
          <Layers size={56} className="empty-icon" />
          <h3>{searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد أنشطة بعد'}</h3>
          <p>{searchQuery ? 'جرب البحث بكلمات أخرى' : 'اضغط «نشاط جديد» لربط محتوى تفاعلي بالدروس'}</p>
        </div>
      ) : (
        <div className="activity-cards">
          {filteredActivities.map(act => {
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
                <label>اختيار عنوان الدرس (من المنهج الدراسي للمقرر بدلاً من الكتابة العشوائية)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={activities.some(a => (a.lessonTitle || '').trim() === lessonTitle.trim()) ? lessonTitle : ''}
                    onChange={e => {
                      if (e.target.value) setLessonTitle(e.target.value);
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}
                  >
                    <option value="">-- اختر درساً من قائمة المقرر --</option>
                    {activities.map((a, idx) => (
                      <option key={a.id || idx} value={a.lessonTitle}>
                        {a.lessonTitle}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="أو اكتب عنوان درس مخصص هنا..."
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
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
            src="/wsylh-logo-full.png?v=6"
            alt="WSYLH Logo"
            style={{ height: '95px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }}
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
            src="/wsylh-logo-full.png?v=6"
            alt="WSYLH Logo"
            style={{ height: '52px', width: 'auto', objectFit: 'contain', display: 'block' }}
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
