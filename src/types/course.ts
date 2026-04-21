import type { TCourseColor } from './colors';
import type { Task } from './task';

export type Daypart = 'EVEN' | 'AM' | 'PM';

export type Course = {
  id: string;
  code: string;
  name: string;
  daypart: Daypart;
  color: TCourseColor;
  createdAt?: Date;
  updatedAt?: Date;
  tasks?: Task[];
};
