/**
 * QuizMiniApp - Interactive quiz mini-application
 * Generates quizzes with optional web-grounded sources and adaptive flow
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MiniAppShell } from './MiniAppShell';
import { MiniAppProps } from './MiniAppTypes';
import { useTheme } from '../../context/ThemeContext';
import { LLMService } from '../../services/llm/LLMService';
import { ToolRegistry } from '../../services/tools/ToolRegistry';

const TOPIC_PRESETS = [
  'World History',
  'Biology Basics',
  'World Geography',
  'General Science',
  'Economics 101',
  'Programming Fundamentals',
  'Climate Change',
  'Astronomy',
  'Nutrition',
  'Art History',
  'Music Theory',
  'Psychology',
  'Statistics',
];

const CATEGORY_PRESETS = [
  'History',
  'Science',
  'Technology',
  'Math',
  'Geography',
  'Languages',
  'Arts',
  'Health',
  'Business',
];

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
const DIFFICULTY_OPTIONS: Array<{ label: string; value: Difficulty; description: string }> = [
  { label: 'Beginner', value: 'beginner', description: 'Short, direct questions' },
  { label: 'Intermediate', value: 'intermediate', description: 'Balanced recall + concepts' },
  { label: 'Advanced', value: 'advanced', description: 'Deeper reasoning and nuance' },
];

type Focus = 'facts' | 'concepts' | 'applied';
const FOCUS_OPTIONS: Array<{ label: string; value: Focus; description: string }> = [
  { label: 'Facts', value: 'facts', description: 'Dates, names, definitions' },
  { label: 'Concepts', value: 'concepts', description: 'Mechanisms and ideas' },
  { label: 'Applied', value: 'applied', description: 'Use knowledge in scenarios' },
];

const QUESTION_COUNTS = [5, 8, 12];
const MAX_SOURCES = 6;
const MAX_SUGGESTIONS = 8;
const DEFAULT_LIVES = 3;
const SKIPPED_ANSWER = -1;

interface QuizSource {
  id: number;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  hint?: string;
  sourceIds?: number[];
}

interface Quiz {
  topic: string;
  difficulty: Difficulty;
  focus: Focus;
  questions: Question[];
  sources?: QuizSource[];
}

function safeDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function extractJson(text: string): any | null {
  const trimmed = String(text || '').trim();

  const tryParse = (raw: string): any | null => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const direct = tryParse(trimmed);
    if (direct) return direct;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    const fenced = tryParse(fenceMatch[1].trim());
    if (fenced) return fenced;
  }

  // Balanced-brace scan for the first JSON object.
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        const candidate = trimmed.slice(start, i + 1);
        const parsed = tryParse(candidate);
        if (parsed) return parsed;
        start = -1;
      }
    }
  }

  return null;
}

function normalizeOptions(options: any, fallbackLabel: string): string[] {
  if (!Array.isArray(options)) return [
    `${fallbackLabel} A`,
    `${fallbackLabel} B`,
    `${fallbackLabel} C`,
    `${fallbackLabel} D`,
  ];
  const cleaned = options.map((opt: any) => String(opt).trim()).filter(Boolean);
  while (cleaned.length < 4) {
    cleaned.push(`${fallbackLabel} ${String.fromCharCode(65 + cleaned.length)}`);
  }
  return cleaned.slice(0, 4);
}

function normalizeQuiz(raw: any, fallback: { topic: string; difficulty: Difficulty; focus: Focus; count: number }, sources: QuizSource[]): Quiz {
  const questionsRaw = Array.isArray(raw?.questions) ? raw.questions : [];
  const questions: Question[] = questionsRaw.map((q: any, idx: number) => {
    const options = normalizeOptions(q?.options, `Option`);
    const correct = Number.isInteger(q?.correctAnswer) ? q.correctAnswer : 0;
    const sourceIds = Array.isArray(q?.sourceIds)
      ? q.sourceIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];

    return {
      id: String(q?.id || `${Date.now()}_${idx}`),
      question: String(q?.question || `Question ${idx + 1}`),
      options,
      correctAnswer: Math.min(Math.max(correct, 0), options.length - 1),
      explanation: q?.explanation ? String(q.explanation) : undefined,
      hint: q?.hint ? String(q.hint) : undefined,
      sourceIds,
    };
  });

  const trimmed = questions.slice(0, fallback.count);

  if (trimmed.length === 0) {
    trimmed.push({
      id: `${Date.now()}_fallback`,
      question: `Which statement best describes ${fallback.topic}?`,
      options: [
        'It is a core concept with real-world impact',
        'It is a fictional idea with no evidence',
        'It is an outdated concept with no use',
        'It is unrelated to any field of study',
      ],
      correctAnswer: 0,
      explanation: `This is a foundational concept in ${fallback.topic}.`,
      sourceIds: [],
    });
  }

  return {
    topic: String(raw?.topic || fallback.topic),
    difficulty: (raw?.difficulty as Difficulty) || fallback.difficulty,
    focus: (raw?.focus as Focus) || fallback.focus,
    questions: trimmed,
    sources,
  };
}

function buildPrompt(params: {
  topic: string;
  difficulty: Difficulty;
  focus: Focus;
  questionCount: number;
  sources: QuizSource[];
  wikiSummary?: string;
}): string {
  const sourceLines = params.sources.map(source => {
    const snippet = source.snippet ? ` - ${source.snippet}` : '';
    return `[${source.id}] ${source.title} (${source.url})${snippet}`;
  }).join('\n');

  const wikiBlock = params.wikiSummary ? `\nWikipedia summary:\n${params.wikiSummary}\n` : '';

  return `Create a multiple-choice quiz about "${params.topic}".

Difficulty: ${params.difficulty}
Focus: ${params.focus}
Number of questions: ${params.questionCount}

Use the sources below when possible. Each question must include a sourceIds array listing the numeric source ids you used. If a question cannot be grounded, use an empty array.

Sources:\n${sourceLines || 'No sources provided.'}
${wikiBlock}
Return ONLY valid JSON with this shape:
{
  "topic": "${params.topic}",
  "difficulty": "${params.difficulty}",
  "focus": "${params.focus}",
  "sources": [{"id": 1, "title": "...", "url": "..."}],
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "hint": "Short hint",
      "explanation": "1-2 sentence explanation",
      "sourceIds": [1, 2]
    }
  ]
}

Rules:
- Only one correct answer per question.
- Options must be short and distinct.
- Explanations should be concise.
- Avoid trick questions or ambiguous wording.
- Keep the tone crisp and Duolingo-like.
- Output JSON only, no markdown or extra text.`;
}

export const QuizMiniApp: React.FC<MiniAppProps> = ({
  visible,
  onClose,
  onShareToChat,
  deviceTier,
  preferredMode,
  isOnline,
  messages,
}) => {
  const { theme } = useTheme();

  const inferredMode = preferredMode === 'auto'
    ? (deviceTier === 'high' ? 'local' : 'api')
    : (preferredMode as 'local' | 'api');

  const [topic, setTopic] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sources, setSources] = useState<QuizSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Preparing quiz');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const [useWebSources, setUseWebSources] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [focus, setFocus] = useState<Focus>('concepts');
  const [questionCount, setQuestionCount] = useState(8);

  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [lives, setLives] = useState(DEFAULT_LIVES);

  const effectiveMode: 'local' | 'api' = isOnline
    ? (useWebSources ? 'api' : inferredMode)
    : 'local';

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setTopic('');
      setQuiz(null);
      setSources([]);
      setCurrentQuestion(0);
      setAnswers([]);
      setShowResults(false);
      setShowHint(false);
      setAnswered(false);
      setLoading(false);
      setError(null);
      setUseWebSources(isOnline);
      setDifficulty('intermediate');
      setFocus('concepts');
      setQuestionCount(8);
      setStreak(0);
      setBestStreak(0);
      setXp(0);
      setLives(DEFAULT_LIVES);
      setShowReview(false);
    }
  }, [visible, isOnline]);

  // Infer topic from last user message if available
  useEffect(() => {
    if (visible && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg && typeof lastUserMsg.content === 'string') {
        const content = lastUserMsg.content.trim();
        if (content.length > 0 && content.length < 60) {
          setTopic(content);
        }
      }
    }
  }, [visible, messages]);

  const messageSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    for (const msg of [...messages].reverse()) {
      if (msg.role !== 'user') continue;
      if (typeof msg.content !== 'string') continue;
      const content = msg.content.trim();
      if (!content || content.length > 60) continue;
      if (!suggestions.includes(content)) suggestions.push(content);
      if (suggestions.length >= 6) break;
    }
    return suggestions;
  }, [messages]);

  const topicSuggestions = useMemo(() => {
    const query = topic.trim().toLowerCase();
    const pool = [...messageSuggestions, ...TOPIC_PRESETS, ...CATEGORY_PRESETS];
    const unique = Array.from(new Set(pool));
    if (!query) return unique.slice(0, MAX_SUGGESTIONS);
    return unique.filter(item => item.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }, [topic, messageSuggestions]);

  const generateQuiz = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    setLoading(true);
    setError(null);
    setLoadingStage('Collecting sources');
    setShowReview(false);

    let gatheredSources: QuizSource[] = [];
    let wikiSummary = '';

    try {
      if (effectiveMode === 'local') {
        const loaded = typeof (LLMService as any).getLoadedLocalModelId === 'function'
          ? (LLMService as any).getLoadedLocalModelId()
          : null;
        if (!loaded) {
          setError('No local GGUF model loaded. Go to Settings → Local Models and load a GGUF first, or switch to Grounded (API).');
          return;
        }
      }

      if (useWebSources && isOnline) {
        const [webResult, wikiResult] = await Promise.all([
          ToolRegistry.executeTool('web_search', { query: `${trimmedTopic} key facts`, num_results: MAX_SOURCES }),
          ToolRegistry.executeTool('wikipedia', { topic: trimmedTopic, language: 'en' }),
        ]);

        const webResults = (webResult as any)?.data?.results || [];
        gatheredSources = webResults.slice(0, MAX_SOURCES).map((result: any) => ({
          id: 0,
          title: String(result.title || 'Source'),
          url: String(result.url || ''),
          snippet: String(result.content || '').slice(0, 180),
          domain: safeDomain(result.url),
        })).filter((source: QuizSource) => source.url);

        const wikiData = (wikiResult as any)?.data;
        if (wikiData?.extract) {
          wikiSummary = String(wikiData.extract).slice(0, 700);
        }
        if (wikiData?.url) {
          gatheredSources = [
            {
              id: 0,
              title: String(wikiData.title || 'Wikipedia'),
              url: String(wikiData.url),
              snippet: String(wikiData.extract || '').slice(0, 180),
              domain: safeDomain(wikiData.url),
            },
            ...gatheredSources,
          ].slice(0, MAX_SOURCES);
        }
      }

      const indexedSources = gatheredSources.map((source, idx) => ({
        ...source,
        id: idx + 1,
      }));

      setLoadingStage('Writing questions');

      const prompt = buildPrompt({
        topic: trimmedTopic,
        difficulty,
        focus,
        questionCount,
        sources: indexedSources,
        wikiSummary,
      });

      const response = await LLMService.generateResponse([
        {
          id: 'quiz_gen',
          conversationId: 'quiz',
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        }
      ], {
        tools: [],
        ...(effectiveMode === 'local' ? { provider: 'llama_rn' } : null),
        mode: effectiveMode === 'api' ? 'api' : 'local',
        temperature: 0.3,
        maxTokens: 1400,
      });

      const parsed = extractJson(response);
      const normalized = normalizeQuiz(parsed || {}, {
        topic: trimmedTopic,
        difficulty,
        focus,
        count: questionCount,
      }, indexedSources);

      setQuiz(normalized);
      setSources(normalized.sources || indexedSources);
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      setError('Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    if (!quiz || answered) return;

    const question = quiz.questions[currentQuestion];
    const isCorrect = question.correctAnswer === answerIndex;

    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestion] = answerIndex;
    setAnswers(updatedAnswers);

    const nextStreak = isCorrect ? streak + 1 : 0;
    setStreak(nextStreak);
    setBestStreak(prev => Math.max(prev, nextStreak));

    if (isCorrect) {
      const bonus = Math.min(10, (nextStreak - 1) * 2);
      setXp(prev => prev + 10 + bonus);
    } else {
      setLives(prev => Math.max(0, prev - 1));
    }

    setAnswered(true);
  };

  const handleNext = () => {
    if (!quiz) return;
    const isLast = currentQuestion >= quiz.questions.length - 1;
    const outOfLives = lives <= 0;

    if (isLast || outOfLives) {
      setShowResults(true);
      return;
    }

    setCurrentQuestion(prev => prev + 1);
    setShowHint(false);
    setAnswered(false);
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    return answers.reduce((score, answer, index) => {
      if (answer === SKIPPED_ANSWER) return score;
      return score + (answer === quiz.questions[index].correctAnswer ? 1 : 0);
    }, 0);
  };

  const handleSkip = () => {
    if (!quiz || answered) return;

    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestion] = SKIPPED_ANSWER;
    setAnswers(updatedAnswers);

    setStreak(0);
    setLives(prev => Math.max(0, prev - 1));
    setAnswered(true);
  };

  const handleQuit = () => {
    if (!quiz) return;
    setShowResults(true);
  };

  const handleShareToChat = () => {
    if (!quiz) return;

    const score = calculateScore();
    const total = quiz.questions.length;
    const percentage = Math.round((score / total) * 100);

    const result = {
      type: 'quiz_result' as const,
      content: `Quiz: ${quiz.topic}\nScore: ${score}/${total} (${percentage}%)\nXP: ${xp}\nBest streak: ${bestStreak}`,
      data: {
        quiz,
        answers,
        score,
        total,
        percentage,
        xp,
        bestStreak,
        sources,
        settings: {
          difficulty,
          focus,
          questionCount,
          useWebSources: useWebSources && isOnline,
        },
      },
    };

    onShareToChat?.(result);
    onClose();
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setShowHint(false);
    setAnswered(false);
    setStreak(0);
    setBestStreak(0);
    setXp(0);
    setLives(DEFAULT_LIVES);
    setShowReview(false);
  };

  const handleNewQuiz = () => {
    handleRestart();
    setQuiz(null);
    setSources([]);
  };

  // Setup screen
  if (!quiz && !loading && !error) {
    return (
      <MiniAppShell
        visible={visible}
        onClose={onClose}
        title="Quiz"
        icon="help-circle"
        mode={effectiveMode}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Topic</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surfaceHighlight,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={topic}
            onChangeText={setTopic}
            placeholder="Type a topic or pick a suggestion"
            placeholderTextColor={theme.colors.textTertiary}
          />

          {topicSuggestions.length > 0 && (
            <View style={styles.suggestionsWrap}>
              {topicSuggestions.map((suggestion, idx) => (
                <Pressable
                  key={`${suggestion}_${idx}`}
                  style={[styles.suggestionChip, { backgroundColor: theme.colors.surfaceHighlight }]}
                  onPress={() => setTopic(suggestion)}
                >
                  <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Quick Picks</Text>
          <View style={styles.suggestionsWrap}>
            {CATEGORY_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                style={[styles.presetChip, { borderColor: theme.colors.border }]}
                onPress={() => setTopic(preset)}
              >
                <Text style={[styles.presetText, { color: theme.colors.textSecondary }]}>
                  {preset}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>Difficulty</Text>
          <View style={styles.optionRow}>
            {DIFFICULTY_OPTIONS.map(option => {
              const selected = difficulty === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceHighlight,
                    },
                  ]}
                  onPress={() => setDifficulty(option.value)}
                >
                  <Text style={[styles.toggleText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            {DIFFICULTY_OPTIONS.find(item => item.value === difficulty)?.description}
          </Text>

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>Focus</Text>
          <View style={styles.optionRow}>
            {FOCUS_OPTIONS.map(option => {
              const selected = focus === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceHighlight,
                    },
                  ]}
                  onPress={() => setFocus(option.value)}
                >
                  <Text style={[styles.toggleText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            {FOCUS_OPTIONS.find(item => item.value === focus)?.description}
          </Text>

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>Question Count</Text>
          <View style={styles.optionRow}>
            {QUESTION_COUNTS.map(count => {
              const selected = questionCount === count;
              return (
                <Pressable
                  key={count}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceHighlight,
                    },
                  ]}
                  onPress={() => setQuestionCount(count)}
                >
                  <Text style={[styles.toggleText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>Accuracy Mode</Text>
          <View style={styles.optionRow}>
            <Pressable
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: useWebSources && isOnline ? theme.colors.primary : theme.colors.surfaceHighlight,
                },
              ]}
              onPress={() => isOnline && setUseWebSources(true)}
              disabled={!isOnline}
            >
              <Text style={[styles.toggleText, { color: useWebSources && isOnline ? '#FFFFFF' : theme.colors.text }]}>
                Grounded
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: !useWebSources || !isOnline ? theme.colors.primary : theme.colors.surfaceHighlight,
                },
              ]}
              onPress={() => setUseWebSources(false)}
            >
              <Text style={[styles.toggleText, { color: !useWebSources || !isOnline ? '#FFFFFF' : theme.colors.text }]}>
                Fast
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            {isOnline
              ? (useWebSources ? 'Uses web sources for accuracy.' : 'Skips web sources for speed.')
              : 'Offline mode uses local generation only.'}
          </Text>

          <Pressable
            style={[
              styles.generateBtn,
              { backgroundColor: topic.trim() ? theme.colors.primary : theme.colors.surfaceHighlight },
            ]}
            onPress={generateQuiz}
            disabled={!topic.trim()}
          >
            <Feather name="play" size={20} color={topic.trim() ? '#FFFFFF' : theme.colors.textTertiary} />
            <Text style={[styles.generateBtnText, { color: topic.trim() ? '#FFFFFF' : theme.colors.textTertiary }]}>
              Start Quiz
            </Text>
          </Pressable>
        </ScrollView>
      </MiniAppShell>
    );
  }

  // Loading screen
  if (loading) {
    return (
      <MiniAppShell
        visible={visible}
        onClose={onClose}
        title="Quiz"
        icon="help-circle"
        mode={effectiveMode}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {loadingStage}...
          </Text>
        </View>
      </MiniAppShell>
    );
  }

  // Error screen
  if (error) {
    return (
      <MiniAppShell
        visible={visible}
        onClose={onClose}
        title="Error"
        icon="alert-circle"
        mode={effectiveMode}
      >
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            {error}
          </Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={generateQuiz}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      </MiniAppShell>
    );
  }

  // Results screen
  if (showResults && quiz) {
    const score = calculateScore();
    const total = quiz.questions.length;
    const percentage = Math.round((score / total) * 100);

    return (
      <MiniAppShell
        visible={visible}
        onClose={onClose}
        title="Results"
        icon="help-circle"
        mode={effectiveMode}
        actions={{ shareToChat: handleShareToChat }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.resultsContainer}>
            <View style={[styles.scoreCircle, { borderColor: theme.colors.primary }]}>
              <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
                {percentage}%
              </Text>
              <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                {score}/{total}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceHighlight }]}
                >
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>XP</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{xp}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceHighlight }]}
                >
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Best Streak</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{bestStreak}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surfaceHighlight }]}
                >
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Lives</Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{lives}</Text>
              </View>
            </View>

            <Text style={[styles.resultMessage, { color: theme.colors.text }]}
            >
              {percentage >= 80
                ? 'Excellent work.'
                : percentage >= 60
                  ? 'Solid progress. Keep going.'
                  : 'Keep practicing. You are building the skill.'}
            </Text>

            <Pressable
              style={[styles.restartBtn, { backgroundColor: theme.colors.surfaceHighlight }]}
              onPress={handleRestart}
            >
              <Feather name="refresh-cw" size={18} color={theme.colors.text} />
              <Text style={[styles.restartText, { color: theme.colors.text }]}>
                Try Again
              </Text>
            </Pressable>

            <Pressable
              style={[styles.restartBtn, { backgroundColor: theme.colors.surfaceHighlight }]}
              onPress={handleNewQuiz}
            >
              <Feather name="edit-3" size={18} color={theme.colors.text} />
              <Text style={[styles.restartText, { color: theme.colors.text }]}>
                New Quiz
              </Text>
            </Pressable>

            <Pressable
              style={[styles.reviewToggleBtn, { borderColor: theme.colors.border }]}
              onPress={() => setShowReview(prev => !prev)}
            >
              <Feather name={showReview ? 'eye-off' : 'eye'} size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.reviewToggleText, { color: theme.colors.textSecondary }]}>
                {showReview ? 'Hide review' : 'Review questions'}
              </Text>
            </Pressable>

            {showReview && (
              <View style={styles.reviewList}>
                {quiz.questions.map((q, idx) => {
                  const userAnswer = answers[idx];
                  const wasCorrect = userAnswer === q.correctAnswer;
                  const wasSkipped = userAnswer === SKIPPED_ANSWER;
                  const userText = userAnswer === SKIPPED_ANSWER
                    ? 'Skipped'
                    : (Number.isInteger(userAnswer) ? q.options[userAnswer] : '—');
                  const correctText = q.options[q.correctAnswer];
                  return (
                    <View
                      key={`${q.id}_${idx}`}
                      style={[
                        styles.reviewItem,
                        { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border },
                      ]}
                    >
                      <View style={styles.reviewHeader}>
                        <Text style={[styles.reviewHeaderText, { color: theme.colors.textSecondary }]}>
                          Q{idx + 1}
                        </Text>
                        <Feather
                          name={wasCorrect ? 'check-circle' : wasSkipped ? 'minus-circle' : 'x-circle'}
                          size={18}
                          color={wasCorrect ? theme.colors.success : wasSkipped ? theme.colors.textSecondary : theme.colors.error}
                        />
                      </View>
                      <Text style={[styles.reviewQuestion, { color: theme.colors.text }]}>{q.question}</Text>
                      <Text style={[styles.reviewMeta, { color: theme.colors.textSecondary }]}>Your answer: {userText}</Text>
                      <Text style={[styles.reviewMeta, { color: theme.colors.textSecondary }]}>Correct: {correctText}</Text>
                      {q.explanation ? (
                        <Text style={[styles.reviewExplanation, { color: theme.colors.textSecondary }]}>{q.explanation}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </MiniAppShell>
    );
  }

  // Quiz screen
  const question = quiz?.questions[currentQuestion];
  if (!question) return null;

  const questionSources = (question.sourceIds || [])
    .map(id => sources.find(source => source.id === id))
    .filter(Boolean) as QuizSource[];

  return (
    <MiniAppShell
      visible={visible}
      onClose={onClose}
      title={quiz?.topic || 'Quiz'}
      icon="help-circle"
      mode={effectiveMode}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceHighlight }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${((currentQuestion + 1) / (quiz?.questions.length || 1)) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
              Question {currentQuestion + 1} of {quiz?.questions.length}
            </Text>
            <View style={styles.progressStats}>
              <View style={styles.progressStatItem}>
                <Feather name="zap" size={14} color={theme.colors.primary} />
                <Text style={[styles.progressStatText, { color: theme.colors.textSecondary }]}>XP {xp}</Text>
              </View>
              <View style={styles.progressStatItem}>
                <Feather name="activity" size={14} color={theme.colors.primary} />
                <Text style={[styles.progressStatText, { color: theme.colors.textSecondary }]}>Streak {streak}</Text>
              </View>
              <View style={styles.progressStatItem}>
                <Feather name="heart" size={14} color={theme.colors.primary} />
                <Text style={[styles.progressStatText, { color: theme.colors.textSecondary }]}>Lives {lives}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.quizActionsRow}>
          <Pressable
            style={[styles.quizActionBtn, { backgroundColor: theme.colors.surfaceHighlight }]}
            onPress={handleQuit}
          >
            <Feather name="x" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.quizActionText, { color: theme.colors.textSecondary }]}>Quit</Text>
          </Pressable>
          <Pressable
            style={[styles.quizActionBtn, { backgroundColor: theme.colors.surfaceHighlight }]}
            onPress={handleSkip}
            disabled={answered}
          >
            <Feather name="skip-forward" size={16} color={answered ? theme.colors.textTertiary : theme.colors.textSecondary} />
            <Text style={[styles.quizActionText, { color: answered ? theme.colors.textTertiary : theme.colors.textSecondary }]}>Skip (-1 life)</Text>
          </Pressable>
        </View>

        <Text style={[styles.questionText, { color: theme.colors.text }]}>
          {question.question}
        </Text>

        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => {
            const isAnswered = answered;
            const isSelected = answers[currentQuestion] === index;
            const isCorrect = question.correctAnswer === index;

            let backgroundColor: string = theme.colors.surfaceHighlight;
            let borderColor: string = theme.colors.border;

            if (isAnswered) {
              if (isCorrect) {
                backgroundColor = 'rgba(16, 185, 129, 0.16)';
                borderColor = theme.colors.success;
              } else if (isSelected) {
                backgroundColor = 'rgba(239, 68, 68, 0.12)';
                borderColor = theme.colors.error;
              }
            }

            return (
              <Pressable
                key={index}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor,
                    borderColor,
                  },
                ]}
                onPress={() => !isAnswered && handleAnswer(index)}
                disabled={isAnswered}
                android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
              >
                <Text style={[styles.optionText, { color: theme.colors.text }]}>
                  {option}
                </Text>
                {isAnswered && isCorrect && (
                  <Feather name="check-circle" size={20} color={theme.colors.success} />
                )}
                {isAnswered && isSelected && !isCorrect && (
                  <Feather name="x-circle" size={20} color={theme.colors.error} />
                )}
              </Pressable>
            );
          })}
        </View>

        {question.hint && !showHint && !answered && (
          <Pressable
            style={[styles.hintButton, { backgroundColor: theme.colors.surfaceHighlight }]}
            onPress={() => setShowHint(true)}
          >
            <Feather name="help-circle" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.hintButtonText, { color: theme.colors.textSecondary }]}>Show hint</Text>
          </Pressable>
        )}

        {showHint && question.hint && (
          <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceHighlight }]}>
            <Text style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
              {question.hint}
            </Text>
          </View>
        )}

        {answered && (
          <View
            style={[
              styles.feedbackBox,
              {
                backgroundColor: theme.colors.surfaceHighlight,
                borderColor: answers[currentQuestion] === question.correctAnswer ? theme.colors.success : theme.colors.error,
              },
            ]}
          >
            <View style={styles.feedbackHeader}>
              <Feather
                name={answers[currentQuestion] === question.correctAnswer ? 'check-circle' : 'x-circle'}
                size={18}
                color={answers[currentQuestion] === question.correctAnswer ? theme.colors.success : theme.colors.error}
              />
              <Text style={[styles.feedbackTitle, { color: theme.colors.text }]}>
                {answers[currentQuestion] === question.correctAnswer
                  ? 'Correct'
                  : answers[currentQuestion] === SKIPPED_ANSWER
                    ? 'Skipped'
                    : 'Not quite'}
              </Text>
            </View>

            <Text style={[styles.feedbackText, { color: theme.colors.textSecondary }]}>
              Correct answer: {question.options[question.correctAnswer]}
            </Text>
            {answers[currentQuestion] !== question.correctAnswer &&
            answers[currentQuestion] !== SKIPPED_ANSWER &&
            Number.isInteger(answers[currentQuestion]) ? (
              <Text style={[styles.feedbackText, { color: theme.colors.textSecondary }]}>
                You picked: {question.options[answers[currentQuestion]]}
              </Text>
            ) : null}

            {question.explanation ? (
              <Text style={[styles.feedbackExplanation, { color: theme.colors.textSecondary }]}>
                {question.explanation}
              </Text>
            ) : null}

            {questionSources.length > 0 && (
              <View style={styles.sourcesWrap}>
                {questionSources.map(source => (
                  <Pressable
                    key={source.id}
                    style={[styles.sourceChip, { borderColor: theme.colors.border }]}
                    onPress={() => Linking.openURL(source.url).catch(() => {})}
                  >
                    <Text style={[styles.sourceText, { color: theme.colors.textSecondary }]}>[{source.id}] {source.domain || source.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {answered && (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {currentQuestion >= (quiz?.questions.length || 0) - 1 || lives <= 0 ? 'Finish' : 'Next'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </MiniAppShell>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 10,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    marginTop: 32,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 18,
  },
  quizActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  quizActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quizActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressMeta: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
  },
  progressStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  progressStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressStatText: {
    fontSize: 12,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  hintButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  explanationBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackExplanation: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  sourcesWrap: {
    marginTop: 12,
    gap: 8,
  },
  sourceChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nextBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 16,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  statCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  resultMessage: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 32,
  },
  restartText: {
    fontSize: 15,
    fontWeight: '600',
  },
  reviewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  reviewToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewList: {
    marginTop: 14,
    gap: 10,
    alignSelf: 'stretch',
  },
  reviewItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewQuestion: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  reviewMeta: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewExplanation: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default QuizMiniApp;
