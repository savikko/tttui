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
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';

const DEBUG = false;

type InputTheme = {
  validationFailureMode: 'keep' | 'clear';
};

const inputTheme: InputTheme = {
  validationFailureMode: 'keep',
};

type InputConfig = {
  message: string;
  value?: string;
  required?: boolean;
  transformer?: (value: string, { isFinal }: { isFinal: boolean }) => string;
  validate?: (value: string) => boolean | string | Promise<string | boolean>;
  theme?: PartialDeep<Theme<InputTheme>>;
};

export default createPrompt<string, InputConfig>((config, done) => {
  const { required, validate = () => true } = config;
  const theme = makeTheme<InputTheme>(inputTheme, config.theme);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setError] = useState<string>();
  const [value, setValue] = useState<string>(config.value || '');
  const [hasInitialized, setHasInitialized] = useState(false);

  const prefix = usePrefix({ status, theme });

  useKeypress(async (key, rl) => {
    if (DEBUG) {
      console.log('Keypress event:', {
        key,
        hasInitialized,
        currentLine: rl.line,
        currentValue: value,
        status,
      });
    }

    // Write initial value if not initialized
    if (!hasInitialized) {
      if (DEBUG) console.log('Initializing with value:', config.value);
      setHasInitialized(true);
      if (config.value) {
        const currentInput = rl.line; // Save the current input
        setValue('');
        rl.line = '';
        rl.write(config.value);
        if (currentInput) {
          rl.write(currentInput); // Append the current input after the initial value
        }
        // If it was an arrow key, write the escape sequence
        if (key.name === 'left') {
          process.stdout.write('\x1B[D'); // Exact sequence from the logs
        }
        if (DEBUG) {
          console.log('After initialization:', {
            line: rl.line,
            value,
            currentInput,
            keyName: key.name,
          });
        }
      }
    }

    // Ignore keypress while our prompt is doing other processing.
    if (status !== 'idle') {
      if (DEBUG) console.log('Ignoring keypress, status:', status);
      return;
    }

    if (isEnterKey(key)) {
      if (DEBUG) console.log('Enter key pressed');
      const answer = rl.line || value;
      setStatus('loading');

      const isValid = required && !answer ? 'You must provide a value' : await validate(answer);
      if (isValid === true) {
        setValue(answer);
        setStatus('done');
        done(answer);
      } else {
        if (theme.validationFailureMode === 'clear') {
          setValue('');
        } else {
          // Reset the readline line value to the previous value
          rl.write(value);
        }
        setError(isValid || 'You must provide a valid value');
        setStatus('idle');
      }
    } else if (isBackspaceKey(key) && !value) {
      setValue('');
    } else {
      setValue(rl.line);
      setError(undefined);
    }
  });

  const message = theme.style.message(config.message, status);
  let formattedValue = value;
  if (typeof config.transformer === 'function') {
    formattedValue = config.transformer(value, { isFinal: status === 'done' });
  } else if (status === 'done') {
    formattedValue = theme.style.answer(value);
  }

  let error = '';
  if (errorMsg) {
    error = theme.style.error(errorMsg);
  }

  return [[prefix, message, formattedValue].filter((v) => v !== undefined).join(' '), error];
});
