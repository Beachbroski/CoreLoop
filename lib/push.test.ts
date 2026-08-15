import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, deleteManyMock, sendMock, chunkMock, isExpoPushTokenMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
  sendMock: vi.fn(),
  chunkMock: vi.fn((messages: unknown[]) => [messages]),
  isExpoPushTokenMock: vi.fn((token: string) => token.startsWith('ExponentPushToken')),
}))

vi.mock('@/lib/prisma', () => ({
  default: { device: { findMany: findManyMock, deleteMany: deleteManyMock } },
}))

vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = isExpoPushTokenMock
    chunkPushNotifications = chunkMock
    sendPushNotificationsAsync = sendMock
  }
  return { Expo }
})

const { sendPushToUser } = await import('./push')

const validToken = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
const otherValidToken = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'

describe('sendPushToUser', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    deleteManyMock.mockReset()
    sendMock.mockReset()
  })

  it('does nothing when the user has no devices', async () => {
    findManyMock.mockResolvedValue([])

    await sendPushToUser('user_1', { title: 'Hi', body: 'There' })

    expect(sendMock).not.toHaveBeenCalled()
    expect(deleteManyMock).not.toHaveBeenCalled()
  })

  it('sends a message to each registered device', async () => {
    findManyMock.mockResolvedValue([{ expoPushToken: validToken }, { expoPushToken: otherValidToken }])
    sendMock.mockResolvedValue([{ status: 'ok' }, { status: 'ok' }])

    await sendPushToUser('user_1', { title: 'You got paid', body: '$50', data: { url: '/earnings' } })

    expect(sendMock).toHaveBeenCalledTimes(1)
    const sent = sendMock.mock.calls[0][0]
    expect(sent).toHaveLength(2)
    expect(sent[0]).toMatchObject({ to: validToken, title: 'You got paid', body: '$50' })
  })

  it('prunes tokens the push service reports as no longer registered', async () => {
    findManyMock.mockResolvedValue([{ expoPushToken: validToken }])
    sendMock.mockResolvedValue([{ status: 'error', details: { error: 'DeviceNotRegistered' } }])

    await sendPushToUser('user_1', { title: 'Hi', body: 'There' })

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { expoPushToken: { in: [validToken] } } })
  })

  it('prunes malformed tokens without trying to send them', async () => {
    findManyMock.mockResolvedValue([{ expoPushToken: 'not-a-real-token' }])

    await sendPushToUser('user_1', { title: 'Hi', body: 'There' })

    expect(sendMock).not.toHaveBeenCalled()
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { expoPushToken: { in: ['not-a-real-token'] } } })
  })

  it('never throws into the caller when the store errors', async () => {
    findManyMock.mockRejectedValue(new Error('db down'))

    await expect(sendPushToUser('user_1', { title: 'Hi', body: 'There' })).resolves.toBeUndefined()
  })
})
