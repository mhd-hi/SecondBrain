import type { Daypart } from '@/types/course';
import type { AddCourseInputFormProps } from '@/types/dialog/add-course-dialog';
import type { SchoolId } from '@/types/school';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAddCourseFormStore } from '@/lib/stores/add-course-form-store';
import {
  getRemainingChars,
  MAX_USER_CONTEXT_LENGTH,
} from '@/lib/utils/sanitize';
import { getDatesForTerm, getNormalizedValidTermId } from '@/lib/utils/term-util';
import { SCHOOL, SCHOOL_INFO } from '@/types/school';
import { TEST_IDS } from '@/lib/testing/selectors';

export function CourseInputForm({
  availableTerms,
  isProcessing,
  currentStep,
  onSubmit,
}: AddCourseInputFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const courseCode = useAddCourseFormStore(state => state.courseCode);
  const setCourseCode = useAddCourseFormStore(state => state.setCourseCode);
  const term = useAddCourseFormStore(state => state.term);
  const setTerm = useAddCourseFormStore(state => state.setTerm);
  const storedFirstDayOfClass = useAddCourseFormStore(state => state.firstDayOfClass);
  const setFirstDayOfClass = useAddCourseFormStore(state => state.setFirstDayOfClass);
  const daypart = useAddCourseFormStore(state => state.daypart);
  const setDaypart = useAddCourseFormStore(state => state.setDaypart);
  const school = useAddCourseFormStore(state => state.school);
  const setSchool = useAddCourseFormStore(state => state.setSchool);
  const userContext = useAddCourseFormStore(state => state.userContext);
  const setUserContext = useAddCourseFormStore(state => state.setUserContext);
  const showDaypartError = useAddCourseFormStore(state => state.showDaypartError);
  const normalizedTerm = getNormalizedValidTermId(term);
  const firstDayOfClass
    = storedFirstDayOfClass ?? (normalizedTerm ? getDatesForTerm(normalizedTerm).start : undefined);

  return (
    <form
      data-testid={TEST_IDS.addCourse.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (currentStep === 'idle' && courseCode.trim()) {
          void onSubmit();
        }
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="courseCode">Course code</Label>
          <div className="flex gap-2">
            <Input
              id="courseCode"
              data-testid={TEST_IDS.addCourse.courseCodeInput}
              value={courseCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                // Limit length to prevent excessively long inputs
                if (value.length <= 10) {
                  setCourseCode(value);
                }
              }}
              placeholder="e.g. MAT145, LOG210"
              disabled={isProcessing}
              maxLength={10}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  currentStep === 'idle' &&
                  courseCode.trim()
                ) {
                  e.preventDefault();
                  void onSubmit();
                }
              }}
            />
            {availableTerms.length > 0 && (
              <Select
                value={term}
                onValueChange={setTerm}
                disabled={isProcessing}
              >
                <SelectTrigger aria-label="Term" data-testid={TEST_IDS.addCourse.termTrigger}>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="school" className="mb-0.5">
            School
          </Label>
          <Select
            value={school}
            onValueChange={value => setSchool(value as SchoolId)}
            disabled={isProcessing}
          >
            <SelectTrigger aria-label="School" data-testid={TEST_IDS.addCourse.schoolTrigger}>
              <SelectValue placeholder="Select school" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCHOOL.NONE}>
                {SCHOOL_INFO[SCHOOL.NONE].label}
              </SelectItem>
              <SelectItem value={SCHOOL.ETS}>
                {SCHOOL_INFO[SCHOOL.ETS].label}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="firstDayOfClass">First day of class</Label>
          <div className={isProcessing ? 'pointer-events-none opacity-50' : ''}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DatePicker
                  date={firstDayOfClass}
                  onDateChange={date => date && setFirstDayOfClass(date)}
                  className="w-full"
                  triggerTestId={TEST_IDS.addCourse.firstDayTrigger}
                  calendarTestId={TEST_IDS.addCourse.firstDayCalendar}
                />
              </div>
              <div className="w-max">
                <Select
                  value={daypart}
                  onValueChange={(v: Daypart | '') => setDaypart(v)}
                  disabled={isProcessing}
                >
                  <SelectTrigger
                    aria-label="Daypart"
                    data-testid={TEST_IDS.addCourse.daypartTrigger}
                    className={
                      showDaypartError && !daypart
                        ? 'border-red-500 ring-2 ring-red-500'
                        : ''
                    }
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                    <SelectItem value="EVEN">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={isProcessing}
            data-testid={TEST_IDS.addCourse.additionalInfoToggle}
            className="bg-muted/30 hover:bg-muted/50 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Label
                htmlFor="userContext"
                className="cursor-pointer font-medium"
              >
                Additional Course Info
              </Label>
              <span className="text-muted-foreground text-xs">(optional)</span>
            </div>
            {isExpanded
? (
              <ChevronUp className="h-4 w-4" />
            )
: (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="animate-in fade-in slide-in-from-top-2 space-y-2 duration-200">
              <Textarea
                id="userContext"
                data-testid={TEST_IDS.addCourse.userContextInput}
                value={userContext}
                onChange={(e) => {
                  setUserContext(e.target.value);
                }}
                placeholder="Provide additional course details to help generate more complete tasks. The AI will create additional tasks based on your input (e.g., weekly quizzes, lab reports, projects not in the plan)..."
                disabled={isProcessing}
                rows={6}
                className={`min-h-30 resize-y ${userContext.length > MAX_USER_CONTEXT_LENGTH ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              <div className="flex items-start justify-between gap-2 text-xs">
                <div className="text-muted-foreground flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Do not include sensitive information.</span>
                </div>
                <span
                  className={`shrink-0 font-mono font-medium ${
                    userContext.length > MAX_USER_CONTEXT_LENGTH
                      ? 'text-red-600 dark:text-red-400'
                      : getRemainingChars(userContext) < 100
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {userContext.length}
/
{MAX_USER_CONTEXT_LENGTH}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
