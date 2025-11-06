// styles/reactSelectStyles.ts
export const rsStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: 'white',
    borderRadius: '.5rem',
    borderColor: state.isFocused ? '#FF7236' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 .5px #FF7236' : 'none',
    '&:hover': 'none',
    minHeight: '2.5rem',
    borderWidth: '2px',
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    zIndex: 50,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#FF7236'
      : state.isFocused
      ? 'white'
      : 'white',
    color: state.isSelected ? 'white' : 'black',
  }),
}

export const rsTheme = (theme: any) => ({
  ...theme,
  borderRadius: 8,
  colors: {
    ...theme.colors,
    primary25: 'white',
    primary: '#FF7236',
  },
})
