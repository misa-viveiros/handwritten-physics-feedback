export type PracticeProblem = {
  id: string
  title: string
  topic:
    | 'kinematics'
    | 'projectile_motion'
    | 'newtons_laws'
    | 'friction'
    | 'energy'
  difficulty: 'introductory' | 'intermediate'
  statement: string
  assumptions?: string[]
  expectedConcepts?: string[]
  commonErrors?: string[]
  studyRecommended: boolean
}

export const problemBank: PracticeProblem[] = [
  {
    id: 'kin-drop-5m',
    title: 'Dropped ball',
    topic: 'kinematics',
    difficulty: 'introductory',
    statement:
      'A ball is dropped from a height of 5.0 m. How long does it take to hit the ground?',
    assumptions: ['Ignore air resistance.', 'Use g = 9.8 m/s^2.'],
    expectedConcepts: ['constant acceleration', 'zero initial velocity'],
    commonErrors: ['using h = vt', 'treating g as a velocity'],
    studyRecommended: true,
  },
  {
    id: 'kin-bike-braking',
    title: 'Bicycle braking',
    topic: 'kinematics',
    difficulty: 'intermediate',
    statement:
      'A bicycle moving at 8.0 m/s slows uniformly to rest in 4.0 s. How far does it travel while slowing down?',
    assumptions: ['Motion is one-dimensional.', 'Acceleration is constant.'],
    expectedConcepts: ['average velocity', 'constant acceleration'],
    commonErrors: ['using the initial speed for the full interval'],
    studyRecommended: true,
  },
  {
    id: 'kin-cart-acceleration',
    title: 'Accelerating cart',
    topic: 'kinematics',
    difficulty: 'introductory',
    statement:
      'A cart starts from rest and accelerates at 2.0 m/s^2 for 6.0 s. What is its final speed?',
    assumptions: ['Acceleration is constant.'],
    expectedConcepts: ['velocity change under constant acceleration'],
    commonErrors: ['adding time and acceleration', 'incorrect units'],
    studyRecommended: true,
  },
  {
    id: 'proj-table',
    title: 'Ball rolling off a table',
    topic: 'projectile_motion',
    difficulty: 'introductory',
    statement:
      'A ball rolls horizontally off a 1.25 m-high table at 3.0 m/s. How far from the table does it land?',
    assumptions: ['Ignore air resistance.', 'Use g = 9.8 m/s^2.'],
    expectedConcepts: ['independent horizontal and vertical motion'],
    commonErrors: ['mixing horizontal speed into vertical motion'],
    studyRecommended: true,
  },
  {
    id: 'proj-launch',
    title: 'Angled launch',
    topic: 'projectile_motion',
    difficulty: 'intermediate',
    statement:
      'A ball is launched at 12 m/s at 35 degrees above horizontal. What are its horizontal and vertical velocity components at launch?',
    assumptions: ['Angles are measured above the horizontal.'],
    expectedConcepts: ['vector components', 'sine and cosine'],
    commonErrors: ['swapping sine and cosine'],
    studyRecommended: true,
  },
  {
    id: 'newton-elevator',
    title: 'Elevator scale reading',
    topic: 'newtons_laws',
    difficulty: 'intermediate',
    statement:
      'A 60 kg person stands on a scale in an elevator accelerating upward at 1.5 m/s^2. What force does the scale exert on the person?',
    assumptions: ['Use g = 9.8 m/s^2.'],
    expectedConcepts: ['net force', 'normal force'],
    commonErrors: ['setting the normal force equal to weight'],
    studyRecommended: true,
  },
  {
    id: 'newton-two-pushes',
    title: 'Opposing pushes',
    topic: 'newtons_laws',
    difficulty: 'introductory',
    statement:
      'A 4.0 kg cart is pushed right with 18 N and left with 6.0 N. What is the cart’s acceleration?',
    assumptions: ['Ignore friction.'],
    expectedConcepts: ['net force', 'Newton’s second law'],
    commonErrors: ['adding forces with opposite directions'],
    studyRecommended: true,
  },
  {
    id: 'friction-sliding-box',
    title: 'Sliding box on a rough floor',
    topic: 'friction',
    difficulty: 'intermediate',
    statement:
      'A box slides to the right across a rough horizontal floor and slows down. Draw and label the forces acting on the box.',
    expectedConcepts: ['weight', 'normal force', 'kinetic friction'],
    commonErrors: ['omitting friction', 'drawing friction with the motion'],
    studyRecommended: true,
  },
  {
    id: 'energy-ramp',
    title: 'Cart descending a ramp',
    topic: 'energy',
    difficulty: 'introductory',
    statement:
      'A 2.0 kg cart starts from rest 1.8 m above the bottom of a frictionless ramp. What is its speed at the bottom?',
    assumptions: ['Ignore rolling energy.', 'Use g = 9.8 m/s^2.'],
    expectedConcepts: ['gravitational potential energy', 'kinetic energy'],
    commonErrors: ['not squaring speed in kinetic energy'],
    studyRecommended: true,
  },
  {
    id: 'energy-spring',
    title: 'Spring launch',
    topic: 'energy',
    difficulty: 'intermediate',
    statement:
      'A 0.50 kg block compresses a horizontal spring with k = 200 N/m by 0.10 m. On a frictionless surface, what speed does the block have when the spring returns to its natural length?',
    assumptions: ['The spring is ideal.', 'The surface is frictionless.'],
    expectedConcepts: ['elastic potential energy', 'kinetic energy'],
    commonErrors: ['omitting the square on compression'],
    studyRecommended: false,
  },
]

export const topicLabels: Record<PracticeProblem['topic'], string> = {
  kinematics: 'Kinematics',
  projectile_motion: 'Projectile motion',
  newtons_laws: "Newton's laws",
  friction: 'Friction',
  energy: 'Energy',
}
