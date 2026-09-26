import { useState } from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PasswordInput({ value, onChange, ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} title={show ? 'Ocultar senha' : 'Mostrar senha'}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
