import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AddButtonContextType {
  onAddPress: (() => void) | undefined;
  setOnAddPress: (handler: (() => void) | undefined) => void;
}

const AddButtonContext = createContext<AddButtonContextType | undefined>(undefined);

export const AddButtonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [onAddPress, setOnAddPress] = useState<(() => void) | undefined>(undefined);

  return (
    <AddButtonContext.Provider value={{ onAddPress, setOnAddPress }}>
      {children}
    </AddButtonContext.Provider>
  );
};

export const useAddButton = () => {
  const context = useContext(AddButtonContext);
  if (!context) {
    // Return a safe default instead of throwing - this allows screens to work outside AddButtonProvider
    return {
      onAddPress: undefined,
      setOnAddPress: () => {
        // No-op when provider is not available
        console.warn('AddButtonProvider not available - setOnAddPress ignored');
      }
    };
  }
  return context;
};

