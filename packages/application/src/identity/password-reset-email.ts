/** Provider-independent password-reset email delivery boundary. */
export interface PasswordResetEmailPort {
  sendPasswordResetEmail(input: {
    readonly email: string;
    readonly resetUrl: string;
  }): Promise<void>;
}
