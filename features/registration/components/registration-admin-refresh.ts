type RefreshableRouter = { refresh: () => void };

export function refreshAfterRegistrationMutation(router: RefreshableRouter) {
  router.refresh();
}
