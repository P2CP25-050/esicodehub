let accessToken: string | null = null;

export const saveTokens = (tokens: {
  access: string;
}) => {
  accessToken = tokens.access;
};

export const getAccessToken = () => accessToken;

export const clearTokens = () => {
  accessToken = null;
};