/**
 * ABI เฉพาะ function ที่ Backend ต้องใช้
 */
export const credentialRegistryAbi = [
  {
    inputs: [
      {
        internalType: 'string',
        name: 'credentialId',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'documentHash',
        type: 'string',
      },
      {
        internalType: 'address',
        name: 'holderAddress',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'issuerSignature',
        type: 'string',
      },
    ],
    name: 'registerCredential',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: 'credentialId',
        type: 'string',
      },
    ],
    name: 'credentialExists',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
