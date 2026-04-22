import type { Daypart } from '@/types/course';
import type { SchoolId } from '@/types/school';
import { create } from 'zustand';
import { DEFAULT_SCHOOL } from '@/types/school';

type AddCourseFormState = {
  courseCode: string;
  term: string;
  firstDayOfClass: Date | undefined;
  daypart: Daypart | '';
  school: SchoolId;
  userContext: string;
  showDaypartError: boolean;
  setCourseCode: (courseCode: string) => void;
  setTerm: (term: string) => void;
  setFirstDayOfClass: (firstDayOfClass: Date | undefined) => void;
  setDaypart: (daypart: Daypart | '') => void;
  setSchool: (school: SchoolId) => void;
  setUserContext: (userContext: string) => void;
  setShowDaypartError: (showDaypartError: boolean) => void;
  reset: () => void;
};

const initialState = {
  courseCode: '',
  term: '',
  firstDayOfClass: undefined,
  daypart: '',
  school: DEFAULT_SCHOOL,
  userContext: '',
  showDaypartError: false,
} satisfies Pick<
  AddCourseFormState,
  'courseCode' | 'term' | 'firstDayOfClass' | 'daypart' | 'school' | 'userContext' | 'showDaypartError'
>;

export const useAddCourseFormStore = create<AddCourseFormState>(set => ({
  ...initialState,
  setCourseCode: courseCode => set({ courseCode }),
  setTerm: term => set({ term }),
  setFirstDayOfClass: firstDayOfClass => set({ firstDayOfClass }),
  setDaypart: daypart => set({ daypart }),
  setSchool: school => set({ school }),
  setUserContext: userContext => set({ userContext }),
  setShowDaypartError: showDaypartError => set({ showDaypartError }),
  reset: () => set(initialState),
}));
