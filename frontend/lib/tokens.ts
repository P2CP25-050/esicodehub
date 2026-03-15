

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const saveTokens = (tokens: {
  access: string;
  refresh: string;
}) => {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => refreshToken;

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
};