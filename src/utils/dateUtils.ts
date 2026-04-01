import { isValid, parseISO } from 'date-fns';

export const safeDate = (date: any): Date => {
  if (!date) return new Date();
  const parsed = typeof date === 'string' ? parseISO(date) : new Date(date);
  return isValid(parsed) ? parsed : new Date();
};
