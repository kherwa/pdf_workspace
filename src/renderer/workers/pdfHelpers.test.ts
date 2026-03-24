import { hexToColor, quadsToBbox } from './pdfHelpers'

describe('hexToColor', () => {
  it('converts red (#ff0000)', () => {
    expect(hexToColor('#ff0000')).toEqual([1, 0, 0])
  })

  it('converts black (#000000)', () => {
    expect(hexToColor('#000000')).toEqual([0, 0, 0])
  })

  it('converts white (#ffffff)', () => {
    expect(hexToColor('#ffffff')).toEqual([1, 1, 1])
  })

  it('handles hex without # prefix', () => {
    expect(hexToColor('ff8800')).toEqual([1, 136 / 255, 0])
  })
})

describe('quadsToBbox', () => {
  it('computes bbox from a single quad', () => {
    // quad: [x0,y0, x1,y1, x2,y2, x3,y3]
    const quad = [10, 20, 50, 20, 10, 40, 50, 40]
    expect(quadsToBbox([quad])).toEqual({ x: 10, y: 20, width: 40, height: 20 })
  })

  it('computes enclosing bbox from multiple quads', () => {
    const q1 = [0, 0, 10, 0, 0, 10, 10, 10]
    const q2 = [20, 20, 30, 20, 20, 30, 30, 30]
    expect(quadsToBbox([q1, q2])).toEqual({ x: 0, y: 0, width: 30, height: 30 })
  })

  it('returns zero-size bbox for a degenerate point quad', () => {
    const quad = [5, 5, 5, 5, 5, 5, 5, 5]
    expect(quadsToBbox([quad])).toEqual({ x: 5, y: 5, width: 0, height: 0 })
  })

  it('handles quads with varying coordinates', () => {
    const quad = [100, 200, 300, 150, 50, 400, 350, 350]
    const bbox = quadsToBbox([quad])
    expect(bbox.x).toBe(50)
    expect(bbox.y).toBe(150)
    expect(bbox.width).toBe(300)
    expect(bbox.height).toBe(250)
  })
})
