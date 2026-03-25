

let accessToken: string | null = null;
let storedRefreshToken: string | null = null;

export const saveTokens = (tokens: {
  access: string;
  refresh: string;
}) => {
  accessToken = tokens.access;
  storedRefreshToken = tokens.refresh;
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => storedRefreshToken;

export const clearTokens = () => {
  accessToken = null;
  storedRefreshToken = null;
};