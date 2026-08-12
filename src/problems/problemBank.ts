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

export type ExampleProblem = {
  id: string
  title: string
  statement: string
}

export const problemExamples: ExampleProblem[] = [
  {
    id: 'example-1',
    title: 'Example 1',
    statement:
      'A ball is dropped from rest from a height of 5.0 m. Neglect air resistance. How long does it take the ball to hit the ground? Use g=9.8 m/s^2',
  },
  {
    id: 'example-2',
    title: 'Example 2',
    statement:
      'A car starts from rest and accelerates uniformly at 2.0 m/s^2 for 6.0 s. How far does it travel?',
  },
  {
    id: 'example-3',
    title: 'Example 3',
    statement:
      'A 2.0 kg object accelerates at 3.0 m/s^2. What is the net force acting on the object?',
  },
  {
    id: 'example-4',
    title: 'Example 4',
    statement:
      'A 2.0 kg object accelerates at 3.0 m/s^2. What is the net force?',
  },
  {
    id: 'example-5',
    title: 'Example 5',
    statement:
      'A ball is thrown straight upward with an initial speed of 14.0 m/s. How long does it take to reach its highest point? Use g=9.8 m/s^2',
  },
  {
    id: 'example-6',
    title: 'Example 6',
    statement:
      'A ball is thrown upward from the roof of a 20.0 m-tall building with an initial speed of 8.0 m/s. How long does it take to reach the ground? Use g=9.8 m/s^2',
  },
  {
    id: 'example-7',
    title: 'Example 7',
    statement:
      'A box slides to the right across a rough horizontal floor and slows down. Draw and label a free-body diagram showing all forces acting on the box.',
  },
  {
    id: 'example-8',
    title: 'Example 8',
    statement:
      'A box slides to the right across a rough horizontal floor and slows down. Draw and label all forces acting on the box.',
  },
  {
    id: 'example-9',
    title: 'Example 9',
    statement:
      'A book rests motionless on a horizontal table. Draw a free-body diagram showing all forces acting on the book.',
  },
  {
    id: 'example-10',
    title: 'Example 10',
    statement:
      'A 5.0 kg block rests on a frictionless 30° incline. Draw and label all forces acting on the block.',
  },
  {
    id: 'example-11',
    title: 'Example 11',
    statement:
      'A block rests on a frictionless incline at angle θ. Resolve the gravitational force into components parallel and perpendicular to the incline.',
  },
  {
    id: 'example-12',
    title: 'Example 12',
    statement:
      'A 3.0 kg box is pulled horizontally to the right with a force of 15 N. Friction exerts a 6 N force to the left. Find the acceleration of the box.',
  },
  {
    id: 'example-13',
    title: 'Example 13',
    statement:
      'A 2.0 kg cart accelerates at 3.0 m/s^2. Find the net force acting on the cart.',
  },
  {
    id: 'example-14',
    title: 'Example 14',
    statement:
      'A cart moves at a constant speed of 4.0 m/s for 5.0 s. How far does it travel?',
  },
  {
    id: 'example-15',
    title: 'Example 15',
    statement:
      "A 4.0 kg crate is pushed to the right with 24 N. Kinetic friction acts to the left with magnitude 8.0 N. Find the crate's acceleration.",
  },
  {
    id: 'example-16',
    title: 'Example 16',
    statement:
      'Two blocks, m_1=2.0 kg and m_2=4.0 kg, rest on a frictionless horizontal surface. The blocks are connected by a light rope. A horizontal force F pulls m_2 to the right. Draw separate free-body diagrams for both blocks.',
  },
  {
    id: 'example-17',
    title: 'Example 17',
    statement:
      'A 10 kg box rests on a horizontal floor. A person pushes horizontally with 20 N, but the box does not move. The coefficient of static friction is μ_s=0.50. Draw the FBD and determine the static-friction force.',
  },
  {
    id: 'example-18',
    title: 'Example 18',
    statement:
      'A car moves at constant speed around a flat circular track. Friction between the tires and road provides the force necessary for circular motion. Draw an FBD for the car.',
  },
]

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
