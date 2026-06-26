import { create } from "twrnc";

export const theme = {
  content: ["./src/navigation/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        'abril': 'AbrilFatface-Regular',
        'dm': 'DMSans',
        'associate': 'AssociateSansRegular',
        'associate-bold': 'AssociateSansBold',
        'associate-medium': 'AssociateSansMedium',
        'associate-light': 'AssociateSansLight',
        'associate-italic': 'AssociateSansRegularItalic',
      },
    }
  }
};

const tw = create(theme);

export default tw;
