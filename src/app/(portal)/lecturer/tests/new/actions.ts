'use server';

import { redirect } from 'next/navigation';
import { createTestWithQuestions } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';
import type { QuestionOption, QuestionType } from '@/lib/database.types';

export async function createCompleteTest(formData: FormData) {
  const connected = isSupabaseConfigured();
  const rawCourseId = requiredText(formData.get('course_id'), 'Course', 64);
  const courseId = connected ? uuid(rawCourseId, 'Course') : rawCourseId;
  const title = requiredText(formData.get('title'), 'Assessment title', 200, 4);
  const description = optionalText(formData.get('description'), 'Description', 2000);
  const durationMinutes = Number(formData.get('duration_minutes'));
  const passingScore = Number(formData.get('passing_score'));
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 300) throw new ValidationError('Duration must be between 5 and 300 minutes.');
  if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) throw new ValidationError('Passing score must be between 0 and 100.');

  const availableFrom = new Date(requiredText(formData.get('available_from'), 'Opening date', 40));
  const availableUntil = new Date(requiredText(formData.get('available_until'), 'Closing date', 40));
  if (Number.isNaN(availableFrom.valueOf()) || Number.isNaN(availableUntil.valueOf()) || availableUntil <= availableFrom) throw new ValidationError('Closing date must be later than opening date.');

  const questions: Array<{ type: QuestionType; prompt: string; options: QuestionOption[] | null; correct_answer: string | null; points: number; order_index: number }> = [];
  for (let index = 1; index <= 3; index += 1) {
    const promptValue = String(formData.get(`question_${index}_prompt`) ?? '').trim();
    if (!promptValue) continue;
    const type = requiredText(formData.get(`question_${index}_type`), 'Question type', 20) as QuestionType;
    if (!['mcq', 'short_answer', 'essay'].includes(type)) throw new ValidationError('Question type is invalid.');
    const prompt = requiredText(promptValue, `Question ${index}`, 10000, 3);
    const points = Number(formData.get(`question_${index}_points`));
    if (!Number.isFinite(points) || points <= 0 || points > 1000) throw new ValidationError(`Question ${index} points are invalid.`);
    let options: QuestionOption[] | null = null;
    let correctAnswer = optionalText(formData.get(`question_${index}_answer`), 'Answer key', 10000);
    if (type === 'mcq') {
      options = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: requiredText(formData.get(`question_${index}_option_${id}`), `Option ${id.toUpperCase()}`, 1000) }));
      if (!correctAnswer || !['a', 'b', 'c', 'd'].includes(correctAnswer)) throw new ValidationError(`Question ${index} needs a valid correct option.`);
    } else if (type === 'short_answer' && !correctAnswer) {
      throw new ValidationError(`Question ${index} needs an answer key.`);
    } else if (type === 'essay') correctAnswer = null;
    questions.push({ type, prompt, options, correct_answer: correctAnswer, points, order_index: questions.length + 1 });
  }
  if (questions.length === 0) throw new ValidationError('Add at least one question.');

  if (connected) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { error } = await supabase.rpc('create_test_with_questions', { payload: {
      courseId, title, description, durationMinutes, passingScore,
      availableFrom: availableFrom.toISOString(), availableUntil: availableUntil.toISOString(),
      published: formData.get('published') === 'on',
      questions: questions.map((question) => ({ type: question.type, prompt: question.prompt, options: question.options, correctAnswer: question.correct_answer, points: question.points }))
    }} as any);
    if (error) throw new Error(error.message);
  } else {
    createTestWithQuestions({ course_id: courseId, title, description, duration_minutes: durationMinutes, passing_score: passingScore, available_from: availableFrom.toISOString(), available_until: availableUntil.toISOString(), published: formData.get('published') === 'on', questions });
  }
  redirect('/lecturer/tests');
}
