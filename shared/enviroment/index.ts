/**
 * Class to get values from the environment values
 */
export default class Environment {
  /**
   * Returns the value for the desired variable
   * @param variableName Variable to get the value from
   */
  public static get(variableName: string): string {
    return process.env[variableName] || '';
  }

  /**
   * Returns the value for the desired variable or the default value if it doesn't exist.
   * @param variableName Variable to get the value from
   * @param defaultValue value to return if the variable doesn't exist.
   */
  public static getOptional(variableName: string, defaultValue?: string): string | undefined {
    const value = Environment.get(variableName);
    return isEmpty(value) ? defaultValue : value;
  }

  /**
   * Returns the value for the desired variable or throws an error if it doesn't exist.
   * @param variableName Variable to get the value from
   */
  public static getRequired(variableName: string): string {
    const value = Environment.get(variableName);
    if (isEmpty(value)) {
      throw new Error(`${variableName} is a required environment variable but is not set or is empty...`);
    }
    return value;
  }
}

function isEmpty(value = ''): boolean {
  return value.length === 0;
}
