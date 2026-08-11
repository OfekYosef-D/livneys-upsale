type ResettableForm = { reset: () => void };
type RefreshableRouter = { refresh: () => void };

export function completeSuccessfulInvite(form: ResettableForm, router: RefreshableRouter) {
  form.reset();
  router.refresh();
}
