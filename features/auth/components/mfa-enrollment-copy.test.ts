import { describe, expect, it } from 'vitest';
import { getMfaEnrollmentCopy } from './mfa-enrollment-copy';

describe('MFA enrollment copy', () => {
  it('offers replacement controls when MFA is already enabled', () => {
    expect(getMfaEnrollmentCopy(true)).toMatchObject({
      title: 'אימות דו-שלבי פעיל',
      button: 'החלפת אפליקציית אימות וקודי שחזור',
    });
  });
});
