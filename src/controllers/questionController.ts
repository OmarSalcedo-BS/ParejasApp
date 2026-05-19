import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/responseUtils';

const getAuthenticatedUser = async (token: string) => {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Usuario no autenticado');
  return user;
};

// Obtener pregunta del día (con estado de la pareja)
export const getTodaysQuestion = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const user = await getAuthenticatedUser(token);
    const today = new Date().toISOString().split('T')[0];

    // Obtener usuario con su pareja
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, couple_id, display_name')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.couple_id) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    const coupleId = userData.couple_id;

    // Contar miembros de la pareja
    const { data: members } = await supabase
      .from('users')
      .select('id')
      .eq('couple_id', coupleId);

    const totalMembers = members?.length || 2;

    // Verificar si el usuario ya respondió hoy
    const { data: myAnswer } = await supabase
      .from('answers')
      .select('id, answer')
      .eq('user_id', user.id)
      .eq('answer_date', today)
      .single();

    // Verificar el estado general de la pregunta del día
    const { data: coupleQuestion } = await supabase
      .from('couple_questions')
      .select('status, question_id')
      .eq('couple_id', coupleId)
      .eq('question_date', today)
      .single();

    // Si ya completaron la pregunta hoy
    if (coupleQuestion?.status === 'completed') {
      return res.status(200).json(successResponse({
        hasAnswered: true,
        completed: true,
        message: 'Ya completaron la pregunta de hoy'
      }, 'Pregunta completada'));
    }

    // Obtener la pregunta actual
    let questionId: number;
    let questionText: string;
    let category: string;

    if (coupleQuestion?.question_id) {
      // Usar la pregunta que está en curso
      const { data: question } = await supabase
        .from('daily_questions')
        .select('id, question, category')
        .eq('id', coupleQuestion.question_id)
        .single();
      
      questionId = question!.id;
      questionText = question!.question;
      category = question!.category;
    } else {
      // Obtener pregunta del día basada en el día del año
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const { data: questions } = await supabase
        .from('daily_questions')
        .select('*')
        .order('id');
      
      const questionIndex = dayOfYear % (questions?.length || 20);
      const question = questions![questionIndex];
      
      questionId = question.id;
      questionText = question.question;
      category = question.category;
    }

    // Verificar cuántos han respondido
    const { data: answers } = await supabase
      .from('answers')
      .select('user_id')
      .eq('couple_id', coupleId)
      .eq('answer_date', today);

    const responders = answers?.map(a => a.user_id) || [];
    const hasPartnerAnswered = responders.length > 0 && !responders.includes(user.id);

    res.status(200).json(successResponse({
      hasAnswered: myAnswer !== null,
      completed: false,
      questionId: questionId,
      question: questionText,
      category: category,
      date: today,
      waitingForPartner: hasPartnerAnswered && myAnswer !== null,
      partnerName: hasPartnerAnswered ? 'tu pareja' : null,
      totalMembers: totalMembers,
      respondersCount: responders.length,
    }, 'Pregunta del día'));

  } catch (error: any) {
    console.error('Error en getTodaysQuestion:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

// Responder pregunta del día
export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const { questionId, answer } = req.body;
    
    if (!questionId || !answer) {
      return res.status(400).json(errorResponse('questionId y answer son requeridos', 400));
    }

    const user = await getAuthenticatedUser(user);
    const today = new Date().toISOString().split('T')[0];

    // Obtener usuario con su pareja
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, couple_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.couple_id) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    const coupleId = userData.couple_id;

    // Verificar si el usuario ya respondió hoy
    const { data: existingAnswer } = await supabase
      .from('answers')
      .select('id')
      .eq('user_id', user.id)
      .eq('answer_date', today)
      .single();

    if (existingAnswer) {
      return res.status(400).json(errorResponse('Ya respondiste la pregunta de hoy', 400));
    }

    // Guardar respuesta
    const { error: insertError } = await supabase
      .from('answers')
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        question_id: questionId,
        answer: answer,
        answer_date: today,
      });

    if (insertError) throw insertError;

    // Obtener la pregunta para la respuesta
    const { data: question } = await supabase
      .from('daily_questions')
      .select('question')
      .eq('id', questionId)
      .single();

    // Verificar el nuevo estado después de guardar
    const { data: members } = await supabase
      .from('users')
      .select('id')
      .eq('couple_id', coupleId);

    const totalMembers = members?.length || 2;

    const { data: answers } = await supabase
      .from('answers')
      .select('user_id')
      .eq('couple_id', coupleId)
      .eq('answer_date', today);

    const respondersCount = answers?.length || 0;
    const isComplete = respondersCount >= totalMembers;

    res.status(201).json(successResponse({
      message: 'Respuesta guardada exitosamente',
      question: question?.question,
      answer: answer,
      date: today,
      isComplete: isComplete,
      waitingForPartner: !isComplete && respondersCount === 1,
    }, 'Respuesta guardada'));

  } catch (error: any) {
    console.error('Error en answerQuestion:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

// Obtener historial de respuestas de la pareja
export const getAnswerHistory = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const user = await getAuthenticatedUser(token);

    const { data: userData } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', user.id)
      .single();

    if (!userData?.couple_id) {
      return res.status(200).json(successResponse([], 'Sin respuestas'));
    }

    const coupleId = userData.couple_id;
    const limit = parseInt(req.query.limit as string) || 30;

    const { data: answers, error } = await supabase
      .from('answers')
      .select(`
        id,
        answer,
        answer_date,
        user_id,
        question:daily_questions(question, category)
      `)
      .eq('couple_id', coupleId)
      .order('answer_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Agrupar por fecha
    const groupedByDate: Map<string, any> = new Map();
    
    answers?.forEach((answer: any) => {
      const date = answer.answer_date;
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, {
          date: date,
          question: answer.question.question,
          category: answer.question.category,
          answers: []
        });
      }
      groupedByDate.get(date).answers.push({
        userId: answer.user_id,
        answer: answer.answer,
      });
    });

    const groupedAnswers = Array.from(groupedByDate.values());

    res.status(200).json(successResponse({
      answers: groupedAnswers,
      count: groupedAnswers.length,
    }, 'Historial de respuestas'));

  } catch (error: any) {
    console.error('Error en getAnswerHistory:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};