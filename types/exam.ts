export type QuestionOption = {
  key: string;
  text: string;
};

export type Question = {
  id: string;
  examNumber: number;
  questionNumber: number;
  prompt: string;
  options: QuestionOption[];
  correctAnswers: string[];
  explanation: string;
  reference?: string;
  multipleAnswer: boolean;
};
