export type TurnstileHost = {
  turnstile?: {
    reset: () => void;
  };
};

export function resetTurnstileChallenge(host: TurnstileHost) {
  host.turnstile?.reset();
}
