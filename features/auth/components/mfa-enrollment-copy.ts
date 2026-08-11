export function getMfaEnrollmentCopy(alreadyEnabled: boolean) {
  return alreadyEnabled
    ? {
        title: 'אימות דו-שלבי פעיל',
        description: 'ההגנה הקיימת תישאר פעילה עד שתאשרו את אפליקציית האימות החדשה. לאחר האישור יופקו קודי שחזור חדשים והקודמים יבוטלו.',
        button: 'החלפת אפליקציית אימות וקודי שחזור',
      }
    : {
        title: 'נדרשת הגדרת אימות דו-שלבי',
        description: 'הגדירו אפליקציית אימות ושמרו את קודי השחזור במקום בטוח.',
        button: 'התחלת הגדרה מאובטחת',
      };
}
