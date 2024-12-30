import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  isEnterKey,
  isBackspaceKey,
  makeTheme,
  type Theme,
  type Status,
  type KeypressEvent,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(duration);
dayjs.extend(customParseFormat);

const DEBUG = false;

type TimeEntryEditTheme = {
  validationFailureMode: 'keep' | 'clear';
};

const timeEntryEditTheme: TimeEntryEditTheme = {
  validationFailureMode: 'keep',
};

type TimeEntryEditConfig = {
  message: string;
  startTime: string;
  endTime?: string;
  description: string;
  required?: boolean;
  theme?: PartialDeep<Theme<TimeEntryEditTheme>>;
};

type TimeEntryEditResult = {
  startTime: string;
  endTime?: string;
  description: string;
};

type DateField = 'year' | 'month' | 'day' | 'hour' | 'minute';
type DateEditingField = 'startTime' | 'endTime';
type TimeField = DateEditingField | 'description';

const isDateEditingField = (field: TimeField): field is DateEditingField => {
  return field === 'startTime' || field === 'endTime';
};

const TIME_FORMAT = 'HH:mm YYYY-MM-DD';

// Add interface for extended key event
interface ExtendedKeypressEvent extends KeypressEvent {
  shift?: boolean;
  sequence?: string;
}

export default createPrompt<TimeEntryEditResult, TimeEntryEditConfig>((config, done) => {
  const { required = true } = config;
  const theme = makeTheme<TimeEntryEditTheme>(timeEntryEditTheme, config.theme);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setError] = useState<string>();
  const [currentField, setCurrentField] = useState<TimeField>('startTime');
  const [currentDateField, setCurrentDateField] = useState<DateField>('hour');
  const [startTime, setStartTime] = useState<dayjs.Dayjs>(dayjs(config.startTime));
  const [endTime, setEndTime] = useState<dayjs.Dayjs | undefined>(
    config.endTime ? dayjs(config.endTime) : undefined
  );
  const [description, setDescription] = useState<string>(config.description);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [editBuffer, setEditBuffer] = useState<string>('');

  const moveToNextField = (current: TimeField): TimeField => {
    switch (current) {
      case 'startTime':
        return endTime ? 'endTime' : 'description';
      case 'endTime':
        return 'description';
      case 'description':
        return 'startTime';
      default:
        return current;
    }
  };

  const moveToPreviousField = (current: TimeField): TimeField => {
    switch (current) {
      case 'endTime':
        return 'startTime';
      case 'description':
        return endTime ? 'endTime' : 'startTime';
      case 'startTime':
        return 'description';
      default:
        return current;
    }
  };

  const prefix = usePrefix({ status, theme });

  // Hide the cursor on initialization
  if (!hasInitialized) {
    process.stdout.write('\x1B[?25l'); // Hide cursor
  }

  // Show cursor when done
  if (status === 'done') {
    process.stdout.write('\x1B[?25h'); // Show cursor
  }

  const validateTimeFormat = (value: string): boolean => {
    return dayjs(value, TIME_FORMAT, true).isValid();
  };

  const validateTimes = (start: dayjs.Dayjs, end?: dayjs.Dayjs): boolean | string => {
    if (end && end.isBefore(start)) {
      return 'End time must be after start time';
    }
    return true;
  };

  const calculateDuration = (start: dayjs.Dayjs, end?: dayjs.Dayjs): string => {
    const endTime = end || dayjs();
    const dur = dayjs.duration(endTime.diff(start));
    const hours = Math.floor(dur.asHours());
    const minutes = dur.minutes();
    return `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}m`;
  };

  const adjustDateField = (field: DateField, amount: number, date: dayjs.Dayjs): dayjs.Dayjs => {
    switch (field) {
      case 'year':
        return date.add(amount, 'year');
      case 'month':
        return date.add(amount, 'month');
      case 'day':
        return date.add(amount, 'day');
      case 'hour':
        return date.add(amount, 'hour');
      case 'minute':
        return date.add(amount, 'minute');
      default:
        return date;
    }
  };

  const formatDateField = (field: DateField, date: dayjs.Dayjs): string => {
    switch (field) {
      case 'year':
        return date.format('YYYY');
      case 'month':
        return date.format('MM');
      case 'day':
        return date.format('DD');
      case 'hour':
        return date.format('HH');
      case 'minute':
        return date.format('mm');
      default:
        return '';
    }
  };

  const formatDateWithHighlight = (
    date: dayjs.Dayjs,
    isActive: boolean,
    field: DateField
  ): string => {
    const parts = [
      field === 'hour' && isActive
        ? '\x1b[32m' + date.format('HH') + '\x1b[39m'
        : date.format('HH'),
      ':',
      field === 'minute' && isActive
        ? '\x1b[32m' + date.format('mm') + '\x1b[39m'
        : date.format('mm'),
      ' ',
      field === 'year' && isActive
        ? '\x1b[32m' + date.format('YYYY') + '\x1b[39m'
        : date.format('YYYY'),
      '-',
      field === 'month' && isActive
        ? '\x1b[32m' + date.format('MM') + '\x1b[39m'
        : date.format('MM'),
      '-',
      field === 'day' && isActive ? '\x1b[32m' + date.format('DD') + '\x1b[39m' : date.format('DD'),
    ];
    return parts.join('');
  };

  const handleDateFieldInput = (
    input: string,
    field: DateField,
    date: dayjs.Dayjs
  ): dayjs.Dayjs | undefined => {
    const newBuffer = editBuffer + input;
    setEditBuffer(newBuffer);

    let format: string;
    let maxLength: number;
    switch (field) {
      case 'year':
        format = 'YYYY';
        maxLength = 4;
        break;
      case 'month':
      case 'day':
        format = 'DD';
        maxLength = 2;
        break;
      case 'hour':
      case 'minute':
        format = 'mm';
        maxLength = 2;
        break;
    }

    if (newBuffer.length === maxLength) {
      const value = parseInt(newBuffer, 10);
      if (!isNaN(value)) {
        setEditBuffer('');
        switch (field) {
          case 'year':
            return date.year(value);
          case 'month':
            return date.month(value - 1); // dayjs months are 0-based
          case 'day':
            return date.date(value);
          case 'hour':
            return date.hour(value);
          case 'minute':
            return date.minute(value);
        }
      }
    }
    return undefined;
  };

  useKeypress(async (key: ExtendedKeypressEvent, rl) => {
    // Clear readline's line to prevent cursor movement
    rl.line = '';

    if (DEBUG) {
      console.log('Keypress event:', {
        key,
        hasInitialized,
        currentField,
        currentDateField,
        status,
        editBuffer,
      });
    }

    // Initialize
    if (!hasInitialized) {
      setHasInitialized(true);
    }

    // Ignore keypress while processing
    if (status !== 'idle') {
      return;
    }

    // Handle description field
    if (!isDateEditingField(currentField)) {
      if (isEnterKey(key)) {
        if (!description && required) {
          setError('Description is required');
          return;
        }
        setStatus('done');
        done({
          startTime: startTime.format(TIME_FORMAT),
          endTime: endTime?.format(TIME_FORMAT),
          description,
        });
      } else if (key.name === 'tab') {
        setCurrentField('startTime');
        setCurrentDateField('hour');
      } else if (key.name === 'left') {
        setCurrentField(endTime ? 'endTime' : 'startTime');
        setCurrentDateField('minute');
      } else if (isBackspaceKey(key)) {
        if (description.length > 0) {
          setDescription(description.slice(0, -1));
        }
      } else if (key.sequence) {
        setDescription(description + key.sequence);
      }
      return;
    }

    const isStartTime = currentField === 'startTime';
    const currentDate = isStartTime ? startTime : endTime || dayjs();

    if (key.name === 'return' || key.name === 'tab') {
      setEditBuffer('');
      const nextField = moveToNextField(currentField);
      setCurrentField(nextField);
      if (isDateEditingField(nextField)) {
        setCurrentDateField('hour');
      }
    } else if (key.name === 'left') {
      setEditBuffer('');
      // In date fields, move between components
      const fields: DateField[] = ['hour', 'minute', 'year', 'month', 'day'];
      const currentIndex = fields.indexOf(currentDateField);
      if (currentIndex === 0) {
        const prevField = moveToPreviousField(currentField);
        setCurrentField(prevField);
        if (isDateEditingField(prevField)) {
          setCurrentDateField('day');
        }
      } else {
        setCurrentDateField(fields[currentIndex - 1]);
      }
    } else if (key.name === 'right') {
      setEditBuffer('');
      // In date fields, move between components
      const fields: DateField[] = ['hour', 'minute', 'year', 'month', 'day'];
      const currentIndex = fields.indexOf(currentDateField);
      if (currentIndex === fields.length - 1) {
        const nextField = moveToNextField(currentField);
        setCurrentField(nextField);
        if (isDateEditingField(nextField)) {
          setCurrentDateField('hour');
        }
      } else {
        setCurrentDateField(fields[currentIndex + 1]);
      }
    } else if (key.name === 'up' || key.name === 'down') {
      setEditBuffer('');
      const amount = key.name === 'up' ? 1 : -1;
      const multiplier = key.shift ? 10 : 1;
      const newDate = adjustDateField(currentDateField, amount * multiplier, currentDate);

      if (isStartTime) {
        setStartTime(newDate);
        if (endTime) {
          const isValid = validateTimes(newDate, endTime);
          if (typeof isValid === 'string') {
            setError(isValid);
            return;
          }
        }
      } else {
        setEndTime(newDate);
        const isValid = validateTimes(startTime, newDate);
        if (typeof isValid === 'string') {
          setError(isValid);
          return;
        }
      }
      setError(undefined);
    } else if (isBackspaceKey(key)) {
      if (editBuffer.length > 0) {
        setEditBuffer(editBuffer.slice(0, -1));
      } else if (currentField === 'endTime' && !endTime) {
        setCurrentField('startTime');
        setCurrentDateField('year');
      }
    } else if (key.sequence && /^\d$/.test(key.sequence)) {
      // Handle numeric input
      const newDate = handleDateFieldInput(key.sequence, currentDateField, currentDate);
      if (newDate) {
        if (isStartTime) {
          setStartTime(newDate);
          if (endTime) {
            const isValid = validateTimes(newDate, endTime);
            if (typeof isValid === 'string') {
              setError(isValid);
              return;
            }
          }
        } else {
          setEndTime(newDate);
          const isValid = validateTimes(startTime, newDate);
          if (typeof isValid === 'string') {
            setError(isValid);
            return;
          }
        }
        setError(undefined);
      }
    }
  });

  const message = theme.style.message(
    `${config.message} (Tab/←→ to move, ↑↓ to change, ⇧+↑↓ for x10, type to edit)`,
    status
  );

  const startTimeStr = formatDateWithHighlight(
    startTime,
    currentField === 'startTime',
    currentDateField
  );
  const endTimeStr = endTime
    ? formatDateWithHighlight(endTime, currentField === 'endTime', currentDateField)
    : currentField === 'endTime'
      ? '\x1b[7mRunning\x1b[27m'
      : 'Running';

  let formattedValue = '';
  if (status === 'done') {
    formattedValue = theme.style.answer(
      `${startTime.format(TIME_FORMAT)} - ${endTime?.format(TIME_FORMAT) || 'Running'} (${calculateDuration(
        startTime,
        endTime
      )}) ${description}`
    );
  } else {
    const descriptionStr = !isDateEditingField(currentField)
      ? '\x1b[32m' + description + '\x1b[32m█\x1b[39m'
      : description;
    const runningStr =
      currentField === 'endTime' && !endTime ? '\x1b[32mRunning\x1b[39m' : 'Running';
    formattedValue = `\n   Start: ${startTimeStr}\n     End: ${endTime ? endTimeStr : runningStr}\n   Duration: ${calculateDuration(startTime, endTime)}\n   Description: ${descriptionStr}`;
  }

  let error = '';
  if (errorMsg) {
    error = theme.style.error(errorMsg);
  }

  return [[prefix, message, formattedValue].filter((v) => v !== undefined).join(' '), error];
});
